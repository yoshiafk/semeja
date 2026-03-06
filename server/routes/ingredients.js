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
  const { name, unit, price_per_unit, category } = req.body;
  if (!name || !unit || !price_per_unit) {
    return res.status(400).json({ error: 'name, unit, and price_per_unit are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO ingredients (name, unit, price_per_unit, category) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), unit, price_per_unit, category || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update ingredient
router.put('/:id', async (req, res) => {
  const { name, unit, price_per_unit, category } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE ingredients SET 
        name = COALESCE($1, name), 
        unit = COALESCE($2, unit), 
        price_per_unit = COALESCE($3, price_per_unit), 
        category = COALESCE($4, category) 
       WHERE id = $5 RETURNING *`,
      [name, unit, price_per_unit, category, req.params.id]
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

module.exports = router;
