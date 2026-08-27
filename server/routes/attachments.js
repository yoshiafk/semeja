const express = require('express');
const router = express.Router();
const multer = require('multer');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Mullter setup for memory storage (we store binary directly in DB)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// POST - Upload a new attachment
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file yang diupload' });
  }

  const { originalname, mimetype, size, buffer } = req.file;

  try {
    const { rows } = await pool.query(
      'INSERT INTO attachments (filename, content_type, size_bytes, data) VALUES ($1, $2, $3, $4) RETURNING id',
      [originalname, mimetype, size, buffer]
    );

    res.json({ 
      id: rows[0].id, 
      url: `/api/attachments/${rows[0].id}`,
      filename: originalname
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Download/View an attachment
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query('SELECT * FROM attachments WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'File tidak ditemukan' });
    }

    const file = rows[0];
    res.setHeader('Content-Type', file.content_type);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Remove an attachment
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query('DELETE FROM attachments WHERE id = $1 RETURNING id', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'File tidak ditemukan' });
    }

    res.json({ message: 'File berhasil dihapus', id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
