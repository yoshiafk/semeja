const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const HOUSE_KEY = process.env.HOUSE_KEY || 'semeja123';

const gatekeeperLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  message: { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' },
  validate: { xForwardedForHeader: false },
});

// Verify the "Front Door" House Key
router.post('/gatekeeper', gatekeeperLimiter, async (req, res) => {
  const { key } = req.body;
  if (key === HOUSE_KEY) {
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Kunci rumah salah. Silakan tanya admin.' });
});

module.exports = router;
