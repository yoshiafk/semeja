/**
 * IMPROVEMENT #3 — Pre-meal ingredient review / overrides
 *
 * Before shopping day, admin reviews the auto-generated quantities for
 * the active plan. They can bump individual ingredient quantities up or
 * down. Those overrides are saved to meal_ingredient_overrides and applied
 * on top of the base recipe quantities when generating the shopping list
 * and cost estimate — the base recipe is never touched.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { convertToWeight } = require('../lib/units');

// GET full ingredient preview for a meal plan
// Returns every ingredient across all meals in the plan, merged with
// any existing override for that (plan, ingredient) pair.
router.get('/:planId', requireAuth, async (req, res) => {
  try {
    const planId = parseInt(req.params.planId);

    // All meals for the plan with participant counts
    const { rows: meals } = await pool.query(
      `SELECT m.id, m.date, m.day_name, m.requires_rice,
              COUNT(p.id)::int as participant_count
       FROM meals m
       LEFT JOIN participations p ON p.meal_id = m.id
       WHERE m.meal_plan_id = $1
       GROUP BY m.id, m.date, m.day_name, m.requires_rice
       ORDER BY m.date`,
      [planId]
    );

    // All ingredients planned across those meals
    const mealIds = meals.map(m => m.id);
    if (mealIds.length === 0) return res.json([]);

    const { rows: ingredients } = await pool.query(
      `SELECT mi.meal_id, mi.ingredient_id, mi.quantity_per_person, mi.unit, mi.meal_type,
              i.name, i.price_per_unit, i.stock_quantity, i.category, i.unit as base_unit
       FROM meal_ingredients mi
       JOIN ingredients i ON mi.ingredient_id = i.id
       WHERE mi.meal_id = ANY($1::int[])
       ORDER BY mi.meal_id, i.category, i.name`,
      [mealIds]
    );

    // Existing overrides for this plan
    const { rows: overrides } = await pool.query(
      `SELECT * FROM meal_ingredient_overrides WHERE meal_plan_id = $1`,
      [planId]
    );
    const overrideMap = {};
    overrides.forEach(o => { overrideMap[o.ingredient_id] = o; });

    // Rice ingredient for rice-required meals
    const { rows: riceRows } = await pool.query(
      "SELECT id as ingredient_id, name, price_per_unit, unit FROM ingredients WHERE name = 'Beras' LIMIT 1"
    );
    const rice = riceRows[0] || null;

    // Aggregate: per-meal breakdown + plan-level ingredient summary
    const mealMap = {};
    meals.forEach(m => { mealMap[m.id] = { ...m, ingredients: [] }; });

    // Track plan-level totals per ingredient
    const planIngredients = {};

    ingredients.forEach(ing => {
      const meal = mealMap[ing.meal_id];
      if (!meal) return;

      const pCount = meal.participant_count;
      const override = overrideMap[ing.ingredient_id];
      const effectiveQty = override
        ? parseFloat(override.override_qty_per_person)
        : parseFloat(ing.quantity_per_person) || 0;

      const totalQty    = effectiveQty * pCount;
      const unit        = ing.unit || ing.base_unit || 'secukupnya';
      const weightQty   = convertToWeight(totalQty, unit, ing.name);
      const costForMeal = weightQty * (parseFloat(ing.price_per_unit) || 0);

      meal.ingredients.push({
        ingredient_id:      ing.ingredient_id,
        name:               ing.name,
        category:           ing.category,
        unit,
        base_qty_per_person: parseFloat(ing.quantity_per_person) || 0,
        override_qty:        override?.override_qty_per_person || null,
        effective_qty:       effectiveQty,
        total_qty:           Number(totalQty.toFixed(3)),
        estimated_cost:      Math.round(costForMeal),
        stock_quantity:      parseFloat(ing.stock_quantity) || 0,
        price_per_unit:      parseFloat(ing.price_per_unit) || 0,
        has_override:        !!override,
      });

      // Aggregate across meals
      const key = ing.ingredient_id;
      if (!planIngredients[key]) {
        planIngredients[key] = {
          ingredient_id:    ing.ingredient_id,
          name:             ing.name,
          category:         ing.category,
          unit,
          price_per_unit:   parseFloat(ing.price_per_unit) || 0,
          stock_quantity:   parseFloat(ing.stock_quantity) || 0,
          total_qty:        0,
          total_cost:       0,
          has_override:     false,
          override_reason:  override?.reason || null,
        };
      }
      planIngredients[key].total_qty  += weightQty;
      planIngredients[key].total_cost += costForMeal;
      if (override) planIngredients[key].has_override = true;
    });

    // Add rice rows for meals that require it
    if (rice) {
      meals.forEach(meal => {
        if (!meal.requires_rice) return;
        const pCount = meal.participant_count;
        const riceQtyPerPerson = 0.15; // kg
        const totalQty = riceQtyPerPerson * pCount;
        const cost     = totalQty * (parseFloat(rice.price_per_unit) || 0);

        mealMap[meal.id].ingredients.push({
          ingredient_id:       rice.ingredient_id,
          name:                'Beras',
          category:            'Pokok',
          unit:                'kg',
          base_qty_per_person: riceQtyPerPerson,
          override_qty:        null,
          effective_qty:       riceQtyPerPerson,
          total_qty:           Number(totalQty.toFixed(3)),
          estimated_cost:      Math.round(cost),
          stock_quantity:      parseFloat(rice.stock_quantity) || 0,
          price_per_unit:      parseFloat(rice.price_per_unit) || 0,
          has_override:        false,
        });

        const key = rice.ingredient_id;
        if (!planIngredients[key]) {
          planIngredients[key] = {
            ingredient_id: rice.ingredient_id,
            name: 'Beras', category: 'Pokok', unit: 'kg',
            price_per_unit: parseFloat(rice.price_per_unit) || 0,
            stock_quantity: parseFloat(rice.stock_quantity) || 0,
            total_qty: 0, total_cost: 0, has_override: false, override_reason: null,
          };
        }
        planIngredients[key].total_qty  += totalQty;
        planIngredients[key].total_cost += cost;
      });
    }

    // Compute shortage (total needed − stock on hand)
    const ingredientSummary = Object.values(planIngredients).map(item => {
      const shortage = Math.max(0, item.total_qty - item.stock_quantity);
      return {
        ...item,
        total_qty:      Number(item.total_qty.toFixed(3)),
        total_cost:     Math.round(item.total_cost),
        shortage:       Number(shortage.toFixed(3)),
        cost_to_buy:    Math.round(shortage * item.price_per_unit),
        has_enough_stock: shortage === 0 && item.total_qty > 0,
      };
    }).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

    res.json({
      meals: Object.values(mealMap),
      ingredient_summary: ingredientSummary,
      total_estimated_cost: ingredientSummary.reduce((s, i) => s + i.total_cost, 0),
      total_cost_to_buy:    ingredientSummary.reduce((s, i) => s + i.cost_to_buy, 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST / PUT save overrides for a plan
// Body: { plan_id, overrides: [{ ingredient_id, override_qty_per_person, reason? }] }
router.post('/:planId/overrides', requireAuth, requireAdmin, async (req, res) => {
  const planId   = parseInt(req.params.planId);
  const { overrides, created_by } = req.body;

  if (!Array.isArray(overrides) || overrides.length === 0) {
    return res.status(400).json({ error: 'overrides[] is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saved = [];
    for (const o of overrides) {
      const { ingredient_id, override_qty_per_person, reason } = o;
      if (!ingredient_id || override_qty_per_person == null) continue;

      const { rows } = await client.query(
        `INSERT INTO meal_ingredient_overrides
           (meal_plan_id, ingredient_id, override_qty_per_person, reason, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (meal_plan_id, ingredient_id) DO UPDATE SET
           override_qty_per_person = EXCLUDED.override_qty_per_person,
           reason                  = EXCLUDED.reason,
           created_at              = NOW()
         RETURNING *`,
        [planId, ingredient_id, override_qty_per_person, reason || null, created_by || null]
      );
      saved.push(rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ saved, count: saved.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE a single override (revert to recipe default)
router.delete('/:planId/overrides/:ingredientId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM meal_ingredient_overrides
       WHERE meal_plan_id = $1 AND ingredient_id = $2`,
      [req.params.planId, req.params.ingredientId]
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
