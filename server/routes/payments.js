/**
 * server/routes/payments.js
 * Payment confirmation ledger for weekly cost settlement.
 * No payment processing — purely tracks who has transferred their share.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/payments/:planId — get all payment records for a plan
router.get('/:planId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, m.name as member_name
       FROM payment_records pr
       JOIN members m ON pr.member_id = m.id
       WHERE pr.meal_plan_id = $1
       ORDER BY m.name`,
      [req.params.planId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments — record or update a payment (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { meal_plan_id, member_id, amount, notes } = req.body;

  if (!meal_plan_id || !member_id || !amount) {
    return res.status(400).json({ error: 'meal_plan_id, member_id, and amount are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO payment_records
         (meal_plan_id, member_id, amount, paid_at, confirmed_by, notes)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       ON CONFLICT (meal_plan_id, member_id)
       DO UPDATE SET
         amount       = EXCLUDED.amount,
         paid_at      = NOW(),
         confirmed_by = EXCLUDED.confirmed_by,
         notes        = EXCLUDED.notes
       RETURNING *`,
      [meal_plan_id, member_id, amount, req.user?.id || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/payments/:planId/:memberId — unmark a payment (admin only)
router.delete('/:planId/:memberId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM payment_records WHERE meal_plan_id = $1 AND member_id = $2',
      [req.params.planId, req.params.memberId]
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
