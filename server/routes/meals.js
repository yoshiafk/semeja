const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

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
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { 
    main_course_menu, 
    second_course_menu, 
    dessert_menu, 
    main_course_recipe_id, 
    second_course_recipe_id, 
    dessert_recipe_id,
    requires_rice
  } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE meals SET 
        main_course_menu = COALESCE($1, main_course_menu),
        second_course_menu = COALESCE($2, second_course_menu),
        dessert_menu = COALESCE($3, dessert_menu),
        main_course_recipe_id = $4,
        second_course_recipe_id = $5,
        dessert_recipe_id = $6,
        requires_rice = COALESCE($7, requires_rice)
       WHERE id = $8 RETURNING *`,
      [
        main_course_menu, 
        second_course_menu, 
        dessert_menu, 
        main_course_recipe_id || null, 
        second_course_recipe_id || null, 
        dessert_recipe_id || null, 
        requires_rice,
        req.params.id
      ]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    // Auto-populate meal_ingredients from recipe
    // Clear existing meal_ingredients
    await client.query('DELETE FROM meal_ingredients WHERE meal_id = $1', [req.params.id]);

    // Copy from main_course recipe
    if (main_course_recipe_id) {
      await client.query(
        `INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity_per_person, meal_type)
         SELECT $1, ingredient_id, quantity_per_person, 'main'
         FROM recipe_ingredients WHERE recipe_id = $2`,
        [req.params.id, main_course_recipe_id]
      );
    }

    // Copy from second_course recipe
    if (second_course_recipe_id) {
      await client.query(
        `INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity_per_person, meal_type)
         SELECT $1, ingredient_id, quantity_per_person, 'second'
         FROM recipe_ingredients WHERE recipe_id = $2
         ON CONFLICT (meal_id, ingredient_id, meal_type) DO UPDATE SET quantity_per_person = EXCLUDED.quantity_per_person`,
        [req.params.id, second_course_recipe_id]
      );
    }

    // Copy from dessert recipe
    if (dessert_recipe_id) {
      await client.query(
        `INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity_per_person, meal_type)
         SELECT $1, ingredient_id, quantity_per_person, 'dessert'
         FROM recipe_ingredients WHERE recipe_id = $2
         ON CONFLICT (meal_id, ingredient_id, meal_type) DO UPDATE SET quantity_per_person = EXCLUDED.quantity_per_person`,
        [req.params.id, dessert_recipe_id]
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
