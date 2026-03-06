const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET meals for a meal plan
router.get('/:mealPlanId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
        (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
       FROM meals m WHERE m.meal_plan_id = $1 ORDER BY m.date`,
      [req.params.mealPlanId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a meal's menu and/or recipe
router.put('/:id', async (req, res) => {
  const { lunch_menu, dinner_menu, lunch_recipe_id, dinner_recipe_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE meals SET 
        lunch_menu = COALESCE($1, lunch_menu),
        dinner_menu = COALESCE($2, dinner_menu),
        lunch_recipe_id = $3,
        dinner_recipe_id = $4
       WHERE id = $5 RETURNING *`,
      [lunch_menu, dinner_menu, lunch_recipe_id || null, dinner_recipe_id || null, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    // Auto-populate meal_ingredients from recipe
    // Clear existing meal_ingredients
    await client.query('DELETE FROM meal_ingredients WHERE meal_id = $1', [req.params.id]);

    // Copy from lunch recipe
    if (lunch_recipe_id) {
      await client.query(
        `INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity_per_person, meal_type)
         SELECT $1, ingredient_id, quantity_per_person, 'lunch'
         FROM recipe_ingredients WHERE recipe_id = $2`,
        [req.params.id, lunch_recipe_id]
      );
    }

    // Copy from dinner recipe
    if (dinner_recipe_id) {
      await client.query(
        `INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity_per_person, meal_type)
         SELECT $1, ingredient_id, quantity_per_person, 'dinner'
         FROM recipe_ingredients WHERE recipe_id = $2
         ON CONFLICT (meal_id, ingredient_id, meal_type) DO UPDATE SET quantity_per_person = EXCLUDED.quantity_per_person`,
        [req.params.id, dinner_recipe_id]
      );
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET meal ingredients for a meal
router.get('/:id/ingredients', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT mi.*, i.name, i.unit, i.price_per_unit, i.category
       FROM meal_ingredients mi
       JOIN ingredients i ON mi.ingredient_id = i.id
       WHERE mi.meal_id = $1
       ORDER BY mi.meal_type, i.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
