const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET meals for a meal plan
router.get('/:mealPlanId', async (req, res) => {
  try {
    const { rows: meals } = await pool.query(
      `SELECT m.*,
        (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
       FROM meals m WHERE m.meal_plan_id = $1 ORDER BY m.date`,
      [req.params.mealPlanId]
    );

    if (meals.length > 0) {
      const mealIds = meals.map(m => m.id);
      const { rows: items } = await pool.query(
        'SELECT * FROM meal_menu_items WHERE meal_id = ANY($1::int[]) ORDER BY sort_order ASC',
        [mealIds]
      );

      for (const meal of meals) {
        meal.items = items.filter(it => it.meal_id === meal.id);
      }
    }

    res.json(meals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a meal's menu and/or recipe
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { 
    items, // Array of { recipe_id, custom_name, category, sort_order }
    requires_rice
  } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update meal basic flags
    const { rows } = await client.query(
      `UPDATE meals SET 
        requires_rice = COALESCE($1, requires_rice)
       WHERE id = $2 RETURNING *`,
      [requires_rice, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    const meal = rows[0];

    // 2. Update menu items
    if (items) {
      await client.query('DELETE FROM meal_menu_items WHERE meal_id = $1', [req.params.id]);
      for (const item of items) {
        await client.query(
          `INSERT INTO meal_menu_items (meal_id, recipe_id, custom_name, category, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, item.recipe_id || null, item.custom_name || '', item.category, item.sort_order || 0]
        );
      }
    }

    // 3. Auto-populate meal_ingredients from all recipes in the items
    await client.query('DELETE FROM meal_ingredients WHERE meal_id = $1', [req.params.id]);
    
    // Fetch current items to get recipe IDs
    const { rows: currentItems } = await client.query(
      'SELECT recipe_id, category FROM meal_menu_items WHERE meal_id = $1 AND recipe_id IS NOT NULL',
      [req.params.id]
    );

    for (const item of currentItems) {
      // Map 'main', 'second', 'dessert' or others to the meal_ingredients 'meal_type'
      // Legacy meal_type was 'main', 'second', 'dessert'
      await client.query(
        `INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity_per_person, unit, meal_type)
         SELECT $1, ingredient_id, quantity_per_person, custom_unit, $3
         FROM recipe_ingredients WHERE recipe_id = $2
         ON CONFLICT (meal_id, ingredient_id, meal_type) 
         DO UPDATE SET 
           quantity_per_person = meal_ingredients.quantity_per_person + EXCLUDED.quantity_per_person,
           unit = EXCLUDED.unit`,
        [req.params.id, item.recipe_id, item.category]
      );
    }

    await client.query('COMMIT');
    
    // Return updated meal with items
    const { rows: updatedItems } = await pool.query(
      'SELECT * FROM meal_menu_items WHERE meal_id = $1 ORDER BY sort_order ASC', [req.params.id]
    );
    meal.items = updatedItems;
    
    res.json(meal);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update meal error:', err);
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
