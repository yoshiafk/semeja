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

// GET buy list for a single meal (daily shopping list)
router.get('/:mealId/buy-list', async (req, res) => {
  try {
    const mealId = parseInt(req.params.mealId);
    const { convertToWeight } = require('../lib/units');

    // 1. Get the meal with participant count
    const { rows: mealRows } = await pool.query(
      `SELECT m.*, mp.week_start, mp.week_end,
        (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
       FROM meals m
       JOIN meal_plans mp ON m.meal_plan_id = mp.id
       WHERE m.id = $1`,
      [mealId]
    );

    if (!mealRows.length) return res.status(404).json({ error: 'Meal not found' });
    const meal = mealRows[0];
    const pCount = parseInt(meal.participant_count) || 0;

    if (pCount === 0) {
      return res.json({ meal_id: mealId, participant_count: 0, items: [], total_estimated_cost: 0 });
    }

    // 2. Get meal ingredients
    const { rows: ingredients } = await pool.query(
      `SELECT mi.*, i.name, i.unit as base_unit, i.price_per_unit,
              i.stock_quantity, i.category, i.id as ingredient_id
       FROM meal_ingredients mi
       JOIN ingredients i ON mi.ingredient_id = i.id
       WHERE mi.meal_id = $1`,
      [mealId]
    );

    // 3. Get rice if required
    let riceIngredient = null;
    if (meal.requires_rice) {
      const { rows: riceRows } = await pool.query(
        "SELECT id as ingredient_id, name, unit, price_per_unit, stock_quantity, category FROM ingredients WHERE name = 'Beras' LIMIT 1"
      );
      riceIngredient = riceRows[0] || null;
    }

    // 4. Get cheapest known supplier per ingredient
    const ingredientIds = ingredients.map(i => i.ingredient_id).filter(Boolean);
    const supplierMap = {};
    if (ingredientIds.length > 0) {
      const { rows: supplierRows } = await pool.query(
        `SELECT DISTINCT ON (p.ingredient_id)
           p.ingredient_id, p.price_per_unit, s.name as supplier_name
         FROM purchases p
         JOIN suppliers s ON p.supplier_id = s.id
         WHERE p.ingredient_id = ANY($1::int[])
         ORDER BY p.ingredient_id, p.price_per_unit ASC, p.purchased_at DESC`,
        [ingredientIds]
      );
      supplierRows.forEach(r => { supplierMap[r.ingredient_id] = r.supplier_name; });
    }

    // 5. Build buy list
    const buyList = {};

    const processIngredient = (ingData) => {
      const qtyPerPerson = parseFloat(ingData.quantity_per_person) || 0;
      const totalQty = qtyPerPerson * pCount;
      const displayUnit = ingData.unit || ingData.base_unit || 'secukupnya';
      const pricePerUnit = parseFloat(ingData.price_per_unit) || 0;
      const weightQty = convertToWeight(totalQty, displayUnit, ingData.name);
      const estimatedCost = Math.round(weightQty * pricePerUnit);
      const stockQty = parseFloat(ingData.stock_quantity) || 0;
      const shortage = Math.max(0, weightQty - stockQty);
      const costToBuy = Math.round(shortage * pricePerUnit);

      const key = `ing_${ingData.ingredient_id}`;
      buyList[key] = {
        ingredient_id: ingData.ingredient_id,
        name: ingData.name,
        unit: ingData.base_unit || displayUnit,
        total_quantity: Number(weightQty.toFixed(3)),
        shortage_quantity: Number(shortage.toFixed(3)),
        estimated_cost: estimatedCost,
        cost_to_buy: costToBuy,
        stock_quantity: stockQty,
        has_enough_stock: shortage === 0,
        category: ingData.category || 'Lainnya',
        cheapest_supplier: supplierMap[ingData.ingredient_id] || null,
        is_untracked: displayUnit === 'secukupnya' || pricePerUnit === 0,
      };
    };

    ingredients.forEach(processIngredient);

    if (riceIngredient) {
      processIngredient({ ...riceIngredient, quantity_per_person: 0.15 });
    }

    // 6. Get purchases already tagged to this meal
    const { rows: existingPurchases } = await pool.query(
      `SELECT p.*, i.name as ingredient_name, s.name as supplier_name
       FROM purchases p
       JOIN ingredients i ON p.ingredient_id = i.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.meal_id = $1
       ORDER BY p.created_at DESC`,
      [mealId]
    );

    const actualSpent = existingPurchases.reduce((sum, p) => sum + (parseInt(p.total_price) || 0), 0);

    const items = Object.values(buyList).sort((a, b) => {
      if (a.category !== b.category) return (a.category || 'z').localeCompare(b.category || 'z');
      return a.name.localeCompare(b.name);
    });

    const needToBuy = items.filter(i => !i.has_enough_stock);

    res.json({
      meal_id: mealId,
      date: meal.date,
      day_name: meal.day_name,
      participant_count: pCount,
      items,
      total_estimated_cost: items.reduce((s, i) => s + i.cost_to_buy, 0),
      actual_spent: actualSpent,
      purchases: existingPurchases,
      shopping_status: actualSpent > 0
        ? (existingPurchases.length >= Math.max(1, needToBuy.length) ? 'done' : 'partial')
        : 'pending',
    });
  } catch (err) {
    console.error('Buy list error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
