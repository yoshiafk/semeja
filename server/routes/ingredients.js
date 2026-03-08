const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all ingredients (optional category filter)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM ingredients ORDER BY category, name';
    let params = [];
    if (category) {
      query = 'SELECT * FROM ingredients WHERE category = $1 ORDER BY name';
      params = [category];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new ingredient
router.post('/', async (req, res) => {
  const { name, unit, price_per_unit, category, stock_quantity, min_stock_threshold } = req.body;
  if (!name || !unit || !price_per_unit) {
    return res.status(400).json({ error: 'name, unit, and price_per_unit are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO ingredients (name, unit, price_per_unit, category, stock_quantity, min_stock_threshold) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name.trim(), unit, price_per_unit, category || '', stock_quantity || 0, min_stock_threshold || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update ingredient
router.put('/:id', async (req, res) => {
  const { name, unit, price_per_unit, category, stock_quantity, min_stock_threshold } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE ingredients SET 
        name = COALESCE($1, name), 
        unit = COALESCE($2, unit), 
        price_per_unit = COALESCE($3, price_per_unit), 
        category = COALESCE($4, category),
        stock_quantity = COALESCE($5, stock_quantity),
        min_stock_threshold = COALESCE($6, min_stock_threshold)
       WHERE id = $7 RETURNING *`,
      [name, unit, price_per_unit, category, stock_quantity, min_stock_threshold, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ingredient
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM ingredients WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT adjust stock
router.put('/:id/stock', async (req, res) => {
  const { adjustment, type } = req.body; // type: 'restock' | 'consume'
  
  if (typeof adjustment !== 'number' || !['restock', 'consume'].includes(type)) {
    return res.status(400).json({ error: 'Valid adjustment number and type (restock|consume) are required' });
  }

  try {
    const query = type === 'restock'
      ? `UPDATE ingredients SET 
          stock_quantity = stock_quantity + $1,
          last_restocked = NOW()
         WHERE id = $2 RETURNING *`
      : `UPDATE ingredients SET 
          stock_quantity = GREATEST(0, stock_quantity - $1)
         WHERE id = $2 RETURNING *`;

    const { rows } = await pool.query(query, [Math.abs(adjustment), req.params.id]);
    
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
