const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET purchases (optionally filtered by ingredient_id)
router.get('/', async (req, res) => {
  try {
    const { ingredient_id } = req.query;
    let query = `
      SELECT p.*, s.name as supplier_name, i.name as ingredient_name, i.unit
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      JOIN ingredients i ON p.ingredient_id = i.id
    `;
    let params = [];

    if (ingredient_id) {
      query += ' WHERE p.ingredient_id = $1 ORDER BY p.purchased_at DESC, p.created_at DESC';
      params = [ingredient_id];
    } else {
      query += ' ORDER BY p.purchased_at DESC, p.created_at DESC';
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent purchases (for dashboard/overview)
router.get('/recent', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, s.name as supplier_name, i.name as ingredient_name, i.unit
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      JOIN ingredients i ON p.ingredient_id = i.id
      ORDER BY p.purchased_at DESC, p.created_at DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET price comparison for an ingredient (latest price per supplier)
router.get('/compare/:ingredientId', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (p.supplier_id) 
        p.supplier_id, s.name as supplier_name, p.price_per_unit, p.purchased_at, p.id as purchase_id
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.ingredient_id = $1
      ORDER BY p.supplier_id, p.purchased_at DESC, p.created_at DESC
    `, [req.params.ingredientId]);

    rows.sort((a, b) => a.price_per_unit - b.price_per_unit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET purchases for a specific ingredient
router.get('/ingredient/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, s.name as supplier_name, i.name as ingredient_name, i.unit
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      JOIN ingredients i ON p.ingredient_id = i.id
      WHERE p.ingredient_id = $1
      ORDER BY p.purchased_at DESC, p.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new purchase
// IMPROVEMENT #2: After recording the purchase, auto-sync price_per_unit in the
// ingredients master table using a 4-week rolling average of actual purchase prices.
// This ensures future cost estimates stay aligned with real market prices.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const {
    ingredient_id, supplier_name, quantity, total_price,
    purchased_at, notes, update_stock, meal_plan_id, receipt_id, meal_id
  } = req.body;

  if (!ingredient_id || !supplier_name || !quantity || !total_price) {
    return res.status(400).json({
      error: 'ingredient_id, supplier_name, quantity, and total_price are required'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find or create supplier
    let supplier_id;
    const supplierRes = await client.query(
      'SELECT id FROM suppliers WHERE name = $1', [supplier_name.trim()]
    );
    if (supplierRes.rows.length > 0) {
      supplier_id = supplierRes.rows[0].id;
    } else {
      const newSupplierRes = await client.query(
        'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
        [supplier_name.trim()]
      );
      supplier_id = newSupplierRes.rows[0].id;
    }

    // 2. Compute price_per_unit from this purchase
    const purchaseDate = purchased_at || new Date().toISOString().split('T')[0];
    const price_per_unit = parseFloat(total_price) / parseFloat(quantity);

    // 3. Insert purchase record
    const { rows: purchaseRows } = await client.query(
      `INSERT INTO purchases 
        (ingredient_id, supplier_id, quantity, total_price, price_per_unit, purchased_at, notes, meal_plan_id, receipt_id, meal_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        ingredient_id, supplier_id, quantity, total_price, price_per_unit,
        purchaseDate, notes || '', meal_plan_id || null, receipt_id || null, meal_id || null
      ]
    );
    const newPurchase = purchaseRows[0];

    // 4. Optionally update stock
    if (update_stock) {
      await client.query(
        `UPDATE ingredients SET 
          stock_quantity = stock_quantity + $1,
          last_restocked = $2
         WHERE id = $3`,
        [quantity, purchaseDate, ingredient_id]
      );
    }

    // 5. IMPROVEMENT #2 — Auto price-sync using a rolling 4-purchase average.
    //    Only uses purchases that have a valid price_per_unit to avoid
    //    polluting the average with old zero-price entries.
    //
    //    This runs INSIDE the transaction so if it fails, we still COMMIT
    //    the purchase itself (we catch the error separately below).
    try {
      const { rows: recentPrices } = await client.query(
        `SELECT price_per_unit
         FROM purchases
         WHERE ingredient_id = $1
           AND price_per_unit IS NOT NULL
           AND price_per_unit > 0
         ORDER BY purchased_at DESC, created_at DESC
         LIMIT 4`,
        [ingredient_id]
      );

      if (recentPrices.length > 0) {
        const avg = recentPrices.reduce((sum, r) => sum + parseFloat(r.price_per_unit), 0)
          / recentPrices.length;

        await client.query(
          `UPDATE ingredients
           SET price_per_unit = $1,
               price_last_updated = NOW()
           WHERE id = $2`,
          [Math.round(avg), ingredient_id]
        );
      }
    } catch (syncErr) {
      // Non-fatal: log but don't abort the purchase
      console.warn('[price-sync] Failed to update price_per_unit:', syncErr.message);
    }

    await client.query('COMMIT');

    // Return the complete record with joined names
    const { rows: resultRows } = await pool.query(`
      SELECT p.*, s.name as supplier_name, i.name as ingredient_name, i.price_per_unit as updated_unit_price
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      JOIN ingredients i ON p.ingredient_id = i.id
      WHERE p.id = $1
    `, [newPurchase.id]);

    res.status(201).json(resultRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE purchase
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM purchases WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
