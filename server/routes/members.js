const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

// GET all members
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM members ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - register/login by name (upsert logic)
router.post('/', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama diperlukan' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM members WHERE name = $1', [name.trim()]);
    
    if (rows.length > 0) {
      const user = rows[0];
      // If user is admin/superadmin, password is REQUIRED
      if (user.role === 'admin' || user.role === 'superadmin') {
        if (!password) {
          return res.status(401).json({ error: 'Password diperlukan untuk akun Admin', needsPassword: true });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return res.status(401).json({ error: 'Password salah' });
        }
      }
      return res.json(user);
    }

    // New Member Registration
    const { rows: newRows } = await pool.query(
      `INSERT INTO members (name) VALUES ($1) RETURNING *`,
      [name.trim()]
    );
    res.json(newRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - update member role (superadmin only)
router.put('/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role, requestedBy } = req.body;
  
  if (!['member', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Verify requester is superadmin
    const requester = await pool.query('SELECT role FROM members WHERE name = $1', [requestedBy]);
    if (!requester.rows.length || requester.rows[0].role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can change roles' });
    }

    const { rows } = await pool.query(
      'UPDATE members SET role = $1 WHERE id = $2 RETURNING *',
      [role, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE member
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM members WHERE id = $1 AND role != $2 RETURNING *',
      [req.params.id, 'superadmin']
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found or cannot delete superadmin' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
