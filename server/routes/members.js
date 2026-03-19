const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { pool } = require('../db');
const { generateToken, requireAuth, verifyToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
  validate: { xForwardedForHeader: false },
});

async function getGeoLocation(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.includes('localhost')) return 'Local';
  try {
    // fields=status,city,countryCode
    const cleanIp = ip.replace('::ffff:', '');
    const { data } = await axios.get(`http://ip-api.com/json/${cleanIp}?fields=status,city,countryCode`, { timeout: 2000 });
    if (data.status === 'success') {
      return `${data.city}, ${data.countryCode}`;
    }
  } catch (err) {
    console.error('Geo IP failed:', err.message);
  }
  return null;
}

// GET all members
router.get('/', async (req, res) => {
  const authHeader = req.headers['authorization'];
  let isAdmin = false;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded && (decoded.role === 'admin' || decoded.role === 'superadmin')) {
      isAdmin = true;
    }
  }

  try {
    const query = isAdmin 
      ? 'SELECT id, name, role, device_id, last_login_at, last_ip, last_user_agent, last_location FROM members ORDER BY name'
      : 'SELECT id, name, role FROM members ORDER BY name';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET current member (session recovery)
router.get('/me', async (req, res) => {
  const deviceId = req.headers['x-device-id'];
  const authHeader = req.headers['authorization'];
  let userId = null;

  // 1. Try to get ID from JWT if present
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = require('../middleware/auth').verifyToken(token);
      if (decoded) userId = decoded.id;
    } catch (e) {
      // Token invalid, fallback to device_id
    }
  }

  try {
    let user;
    if (userId) {
      const { rows } = await pool.query('SELECT id, name, role, device_id FROM members WHERE id = $1', [userId]);
      user = rows[0];
    } else if (deviceId) {
      const { rows } = await pool.query('SELECT id, name, role, device_id FROM members WHERE device_id = $1', [deviceId]);
      // Only auto-login standard members via device_id alone
      if (rows.length > 0 && rows[0].role === 'member') {
        user = rows[0];
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Session not found' });
    }

    // Update last login metadata
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const location = await getGeoLocation(ip);
    await pool.query(
      'UPDATE members SET last_login_at = NOW(), last_ip = $1, last_user_agent = $2, last_location = $3 WHERE id = $4',
      [ip, ua, location, user.id]
    );

    res.json({ ...user, token: generateToken(user) });
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

  // Name validation: Alphanumeric, spaces, dots, hyphens, min 2 chars
  const nameRegex = /^[a-zA-Z0-9\s.\-]{2,50}$/;
  if (!nameRegex.test(name.trim())) {
    return res.status(400).json({ 
      error: 'Nama hanya boleh berisi huruf, angka, spasi, titik, atau tanda hubung (min. 2 karakter)' 
    });
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
      
      // Update last login metadata
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const ua = req.headers['user-agent'];
      const location = await getGeoLocation(ip);
      await pool.query(
        'UPDATE members SET last_login_at = NOW(), last_ip = $1, last_user_agent = $2, last_location = $3 WHERE id = $4',
        [ip, ua, location, user.id]
      );
      
      return res.json({ ...user, token: generateToken(user) });
    }

    // New Member Registration
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const location = await getGeoLocation(ip);
    const { rows: newRows } = await pool.query(
      `INSERT INTO members (name, device_id, last_login_at, last_ip, last_user_agent, last_location) VALUES ($1, $2, NOW(), $3, $4, $5) RETURNING *`,
      [name.trim(), deviceId, ip, ua, location] // Store the original casing but index is lowercase
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
