const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');



// GET all meal plans (batch query instead of N+1)
router.get('/', async (req, res) => {
  try {
    const { rows: plans } = await pool.query('SELECT * FROM meal_plans ORDER BY week_start DESC');
    const planIds = plans.map(p => p.id);
    let allMeals = [];
    if (planIds.length > 0) {
      const { rows: meals } = await pool.query(
        `SELECT m.*,
          (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
         FROM meals m WHERE m.meal_plan_id = ANY($1::int[]) ORDER BY m.date`,
        [planIds]
      );
      
      const { rows: items } = await pool.query(
        'SELECT * FROM meal_menu_items WHERE meal_id = ANY($1::int[]) ORDER BY sort_order ASC',
        [meals.map(m => m.id)]
      );

      for (const meal of meals) {
        meal.items = items.filter(it => it.meal_id === meal.id);
      }
      
      allMeals = meals;
    }
    for (const plan of plans) {
      plan.meals = allMeals.filter(m => m.meal_plan_id === plan.id);
    }
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET active meal plans (batch query instead of N+1)
router.get('/active', async (req, res) => {
  try {
    const { rows: plans } = await pool.query(
      "SELECT * FROM meal_plans WHERE status = 'active' ORDER BY week_start ASC"
    );
    const planIds = plans.map(p => p.id);
    let allMeals = [];
    if (planIds.length > 0) {
      const { rows: meals } = await pool.query(
        `SELECT m.*,
          (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
         FROM meals m WHERE m.meal_plan_id = ANY($1::int[]) ORDER BY m.date`,
        [planIds]
      );
      
      const { rows: items } = await pool.query(
        'SELECT * FROM meal_menu_items WHERE meal_id = ANY($1::int[]) ORDER BY sort_order ASC',
        [meals.map(m => m.id)]
      );

      for (const meal of meals) {
        meal.items = items.filter(it => it.meal_id === meal.id);
      }
      
      allMeals = meals;
    }
    for (const plan of plans) {
      plan.meals = allMeals.filter(m => m.meal_plan_id === plan.id);
    }
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new meal plan (auto-generates 7 days)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { week_start } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const startDate = new Date(week_start);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const { rows } = await client.query(
      'INSERT INTO meal_plans (week_start, week_end) VALUES ($1, $2) RETURNING *',
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );
    const plan = rows[0];

    // Create 7 meal entries
    const daysInIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayName = daysInIndonesian[d.getDay()];
      
      await client.query(
        'INSERT INTO meals (meal_plan_id, date, day_name) VALUES ($1, $2, $3)',
        [plan.id, d.toISOString().split('T')[0], dayName]
      );
    }

    await client.query('COMMIT');

    const { rows: meals } = await pool.query(
      'SELECT * FROM meals WHERE meal_plan_id = $1 ORDER BY date', [plan.id]
    );
    plan.meals = meals;
    res.status(201).json(plan);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update meal plan status
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE meal_plans SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE meal plan
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM meal_plans WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
