const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET all participations for a meal plan
router.get('/:mealPlanId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, m.name as member_name, ml.date, ml.day_name
       FROM participations p
       JOIN members m ON p.member_id = m.id
       JOIN meals ml ON p.meal_id = ml.id
       WHERE ml.meal_plan_id = $1
       ORDER BY ml.date, m.name`,
      [req.params.mealPlanId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST member joins a day
router.post('/', requireAuth, async (req, res) => {
  const { meal_id, member_id } = req.body;
  if (!meal_id || !member_id) {
    return res.status(400).json({ error: 'meal_id and member_id required' });
  }
  try {
    // Check if the meal has any menu items
    const { rows: items } = await pool.query(
      'SELECT id FROM meal_menu_items WHERE meal_id = $1 LIMIT 1',
      [meal_id]
    );

    if (items.length === 0) {
      return res.status(400).json({ error: 'Cannot join a meal that has no menu items yet' });
    }

    // RSVP deadline & plan lock enforcement
    const { rows: planRows } = await pool.query(
      `SELECT mp.rsvp_deadline, mp.status
       FROM meals m
       JOIN meal_plans mp ON m.meal_plan_id = mp.id
       WHERE m.id = $1`,
      [meal_id]
    );

    if (planRows.length) {
      const plan = planRows[0];
      let role = null;

      // Check if plan is locked (shopping/closed/archived) OR deadline passed
      const isLocked = ['shopping', 'closed', 'archived'].includes(plan.status);
      const isDeadlinePassed = plan.rsvp_deadline && new Date() > new Date(plan.rsvp_deadline);

      if (isLocked || isDeadlinePassed) {
        const { rows: memberRows } = await pool.query(
          'SELECT role FROM members WHERE id = $1', [member_id]
        );
        role = memberRows[0]?.role;
        const isAdmin = role === 'superadmin' || role === 'admin';

        if (!isAdmin) {
          if (isLocked) {
            return res.status(403).json({
              error: 'Pendaftaran sudah ditutup untuk minggu ini',
              code: 'RSVP_LOCKED'
            });
          }
          if (isDeadlinePassed) {
            return res.status(403).json({
              error: 'Batas waktu pendaftaran sudah lewat',
              code: 'DEADLINE_PASSED',
              deadline: plan.rsvp_deadline
            });
          }
        }
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO participations (meal_id, member_id) VALUES ($1, $2)
       ON CONFLICT (meal_id, member_id) DO NOTHING
       RETURNING *`,
      [meal_id, member_id]
    );
    res.status(201).json(rows[0] || { meal_id, member_id, exists: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE member leaves a day
router.delete('/:mealId/:memberId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM participations WHERE meal_id = $1 AND member_id = $2',
      [req.params.mealId, req.params.memberId]
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
