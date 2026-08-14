const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET all suppliers
router.get('/', async (req, res) => {
  try {
    // Get suppliers with a count of their purchases and the date of the most recent purchase
    const { rows } = await pool.query(`
      SELECT 
        s.*,
        COUNT(p.id)::int as total_purchases,
        MAX(p.purchased_at) as last_purchase_date
      FROM suppliers s
      LEFT JOIN purchases p ON s.id = p.supplier_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET supplier by id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update supplier
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, location, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE suppliers SET 
        name = COALESCE($1, name), 
        location = COALESCE($2, location), 
        notes = COALESCE($3, notes) 
       WHERE id = $4 RETURNING *`,
      [name, location, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE supplier
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
