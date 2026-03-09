const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' }
});

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
router.post('/', loginLimiter, async (req, res) => {
  const { name, password } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama diperlukan' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM members WHERE name = $1', [name.trim()]);
    
    if (rows.length > 0) {
      const user = rows[0];
      // If user is admin/superadmin, require password (only if one has been set)
      if (user.role === 'admin' || user.role === 'superadmin') {
        if (user.password_hash) {
          // Password exists — must authenticate
          if (!password) {
            return res.status(200).json({ 
              needsPassword: true, 
              message: 'Password diperlukan untuk akun Admin' 
            });
          }
          const isMatch = await bcrypt.compare(password, user.password_hash);
          if (!isMatch) {
            return res.status(401).json({ error: 'Password salah' });
          }
          return res.json({ ...user, token: generateToken(user) });
        } else {
          // No password set yet — let them in but flag it
          return res.json({ ...user, needsPasswordSetup: true, token: generateToken(user) });
        }
      }
      return res.json({ ...user, token: generateToken(user) });
    }

    // New Member Registration
    const { rows: newRows } = await pool.query(
      `INSERT INTO members (name) VALUES ($1) RETURNING *`,
      [name.trim()]
    );
    const newUser = newRows[0];
    res.json({ ...newUser, token: generateToken(newUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - update member role (superadmin only)
router.put('/:id/role', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!['member', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Verify requester is superadmin using JWT token
    if (req.user.role !== 'superadmin') {
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

// PUT - set or change password (for admin/superadmin)
router.put('/:id/password', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Verify the JWT matches the user ID being updated, or is superadmin
  if (req.user.id !== parseInt(id) && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Tidak memiliki akses untuk mengubah password user ini' });
  }

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password minimal 4 karakter' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });

    const user = rows[0];

    // If user already has a password, verify the current one
    if (user.password_hash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Password lama diperlukan' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Password lama salah' });
      }
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE members SET password_hash = $1 WHERE id = $2', [hash, id]);
    res.json({ success: true, message: 'Password berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE member
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Only superadmin can delete members
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Hanya superadmin yang dapat menghapus member' });
    }

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
