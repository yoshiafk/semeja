const express = require('express');
const router = express.Router();
const { pool } = require('../db');

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
    // Uses DISTINCT ON to get the latest purchase per supplier for this ingredient
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (p.supplier_id) 
        p.supplier_id, s.name as supplier_name, p.price_per_unit, p.purchased_at, p.id as purchase_id
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.ingredient_id = $1
      ORDER BY p.supplier_id, p.purchased_at DESC, p.created_at DESC
    `, [req.params.ingredientId]);
    
    // Sort the results by price_per_unit ascending so the cheapest is first
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
router.post('/', async (req, res) => {
  const { ingredient_id, supplier_name, quantity, total_price, purchased_at, notes, update_stock, meal_plan_id } = req.body;

  if (!ingredient_id || !supplier_name || !quantity || !total_price) {
    return res.status(400).json({ error: 'ingredient_id, supplier_name, quantity, and total_price are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find or create supplier
    let supplier_id;
    const supplierRes = await client.query('SELECT id FROM suppliers WHERE name = $1', [supplier_name.trim()]);
    
    if (supplierRes.rows.length > 0) {
      supplier_id = supplierRes.rows[0].id;
    } else {
      const newSupplierRes = await client.query(
        'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
        [supplier_name.trim()]
      );
      supplier_id = newSupplierRes.rows[0].id;
    }

    // 2. Insert purchase record
    const purchaseDate = purchased_at || new Date().toISOString().split('T')[0];
    const { rows: purchaseRows } = await client.query(
      `INSERT INTO purchases 
        (ingredient_id, supplier_id, quantity, total_price, purchased_at, notes, meal_plan_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [ingredient_id, supplier_id, quantity, total_price, purchaseDate, notes || '', meal_plan_id || null]
    );

    const newPurchase = purchaseRows[0];

    // 3. Optionally update stock
    if (update_stock) {
      await client.query(
        `UPDATE ingredients SET 
          stock_quantity = stock_quantity + $1,
          last_restocked = $2
         WHERE id = $3`,
        [quantity, purchaseDate, ingredient_id]
      );
    }

    await client.query('COMMIT');
    
    // Fetch the complete record with joined names to return
    const { rows: resultRows } = await client.query(`
      SELECT p.*, s.name as supplier_name, i.name as ingredient_name
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
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM purchases WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
