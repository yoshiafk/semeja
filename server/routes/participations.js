const express = require('express');
const router = express.Router();
const { pool } = require('../db');

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
router.post('/', async (req, res) => {
  const { meal_id, member_id } = req.body;
  if (!meal_id || !member_id) {
    return res.status(400).json({ error: 'meal_id and member_id required' });
  }
  try {
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
router.delete('/:mealId/:memberId', async (req, res) => {
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
