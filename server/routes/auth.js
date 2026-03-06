const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const HOUSE_KEY = process.env.HOUSE_KEY || 'semeja123';

// Verify the "Front Door" House Key
router.post('/gatekeeper', async (req, res) => {
  const { key } = req.body;
  if (key === HOUSE_KEY) {
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Kunci rumah salah. Silakan tanya admin.' });
});

module.exports = router;
