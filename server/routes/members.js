const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
  validate: { xForwardedForHeader: false },
});

// GET all members
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, role, device_id FROM members ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - register/login by name (upsert logic)
router.post('/', loginLimiter, async (req, res) => {
  const { name, password } = req.body;
  const deviceId = req.headers['x-device-id'];
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama diperlukan' });
  }

  const normalizedName = name.trim().toLowerCase();

  try {
    // Case-insensitive lookup using LOWER(name)
    const { rows } = await pool.query('SELECT * FROM members WHERE LOWER(name) = $1', [normalizedName]);
    
    if (rows.length > 0) {
      const user = rows[0];

      // TRUST LOGIC: If deviceId matches, bypass password for non-admins
      const isTrustedDevice = deviceId && user.device_id === deviceId;

      // If user is admin/superadmin, require password
      if (user.role === 'admin' || user.role === 'superadmin') {
        if (user.password_hash) {
          // Trusted device can bypass password even for admins? 
          // Let's be safer: Admin always needs password on new login, 
          // but silent re-auth (handled by token) is fine.
          // For initial POST login, admin always needs password if it exists.
          if (!isTrustedDevice) {
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
          }
        } else {
          // No password set yet
          return res.json({ ...user, needsPasswordSetup: true, token: generateToken(user) });
        }
      } else {
        // Standard member: bypass if device matches, otherwise just let them in (current behavior)
        // We update the device_id if it's not set yet
        if (deviceId && !user.device_id) {
          await pool.query('UPDATE members SET device_id = $1 WHERE id = $2', [deviceId, user.id]);
          user.device_id = deviceId;
        }
      }
      
      return res.json({ ...user, token: generateToken(user) });
    }

    // New Member Registration
    const { rows: newRows } = await pool.query(
      `INSERT INTO members (name, device_id) VALUES ($1, $2) RETURNING *`,
      [name.trim(), deviceId] // Store the original casing but index is lowercase
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
