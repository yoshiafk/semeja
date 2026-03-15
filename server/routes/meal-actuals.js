/**
 * IMPROVEMENT #1 — Post-meal ingredient calibration
 *
 * After each meal day passes, admin can record the actual qty-per-person used
 * for each ingredient. These actuals are stored in ingredient_actuals, and the
 * rolling 4-week average is used to progressively correct quantity_per_person
 * in meal_ingredients so future shopping lists become more accurate over time.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET actuals for a specific meal
// Returns each ingredient with its estimated qty and any recorded actual
router.get('/:mealId', requireAuth, async (req, res) => {
  try {
    const mealId = parseInt(req.params.mealId);

    // Get ingredients planned for this meal
    const { rows: planned } = await pool.query(
      `SELECT mi.id as meal_ingredient_id, mi.ingredient_id, mi.quantity_per_person as estimated_qty,
              mi.unit, i.name, i.category
       FROM meal_ingredients mi
       JOIN ingredients i ON mi.ingredient_id = i.id
       WHERE mi.meal_id = $1
       ORDER BY i.category, i.name`,
      [mealId]
    );

    // Get any actuals already recorded for this meal
    const { rows: actuals } = await pool.query(
      `SELECT * FROM ingredient_actuals WHERE meal_id = $1`,
      [mealId]
    );
    const actualsMap = {};
    actuals.forEach(a => { actualsMap[a.ingredient_id] = a; });

    // Merge
    const result = planned.map(ing => ({
      ...ing,
      actual_qty: actualsMap[ing.ingredient_id]?.actual_qty_per_person || null,
      actual_notes: actualsMap[ing.ingredient_id]?.notes || null,
      is_calibrated: !!actualsMap[ing.ingredient_id],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET list of past meals that need calibration (date has passed, not yet calibrated)
router.get('/pending/:planId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const planId = parseInt(req.params.planId);
    const today = new Date().toISOString().split('T')[0];

    const { rows } = await pool.query(
      `SELECT m.id, m.date, m.day_name,
              (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count,
              (SELECT COUNT(*) FROM meal_ingredients mi WHERE mi.meal_id = m.id) as ingredient_count,
              (SELECT COUNT(*) FROM ingredient_actuals ia WHERE ia.meal_id = m.id) as calibrated_count
       FROM meals m
       WHERE m.meal_plan_id = $1
         AND m.date < $2
       ORDER BY m.date DESC`,
      [planId, today]
    );

    // Mark each meal as fully_calibrated, partially_calibrated, or uncalibrated
    const result = rows.map(m => ({
      ...m,
      calibration_status:
        parseInt(m.calibrated_count) === 0 ? 'uncalibrated' :
        parseInt(m.calibrated_count) < parseInt(m.ingredient_count) ? 'partial' : 'done',
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save actuals for a meal
// Body: { meal_id, actuals: [{ ingredient_id, actual_qty_per_person, notes? }] }
// After saving, updates meal_ingredients.quantity_per_person using a rolling 4-record average
// of actual_qty_per_person so future plans auto-correct.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { meal_id, actuals, recorded_by } = req.body;

  if (!meal_id || !Array.isArray(actuals) || actuals.length === 0) {
    return res.status(400).json({ error: 'meal_id and actuals[] are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saved = [];

    for (const entry of actuals) {
      const { ingredient_id, actual_qty_per_person, notes } = entry;
      if (!ingredient_id || actual_qty_per_person == null) continue;

      // Upsert into ingredient_actuals
      const { rows } = await client.query(
        `INSERT INTO ingredient_actuals
           (meal_id, ingredient_id, actual_qty_per_person, estimated_qty_per_person, recorded_by, notes)
         VALUES ($1, $2, $3,
           (SELECT quantity_per_person FROM meal_ingredients
            WHERE meal_id = $1 AND ingredient_id = $2 LIMIT 1),
           $4, $5)
         ON CONFLICT (meal_id, ingredient_id)
         DO UPDATE SET
           actual_qty_per_person = EXCLUDED.actual_qty_per_person,
           notes = EXCLUDED.notes,
           recorded_at = NOW()
         RETURNING *`,
        [meal_id, ingredient_id, actual_qty_per_person, recorded_by || null, notes || null]
      );
      saved.push(rows[0]);

      // Rolling average: compute the 4 most recent actual_qty_per_person values
      // for this ingredient across all meals, then update meal_ingredients for
      // this meal so future summaries and shopping lists use better quantities.
      const { rows: recent } = await client.query(
        `SELECT actual_qty_per_person
         FROM ingredient_actuals
         WHERE ingredient_id = $1
           AND actual_qty_per_person > 0
         ORDER BY recorded_at DESC
         LIMIT 4`,
        [ingredient_id]
      );

      if (recent.length > 0) {
        const avg = recent.reduce((s, r) => s + parseFloat(r.actual_qty_per_person), 0) / recent.length;

        // Update the planned quantity for THIS meal (so this week's shopping list
        // is corrected if it hasn't been purchased yet).
        await client.query(
          `UPDATE meal_ingredients
           SET quantity_per_person = $1
           WHERE meal_id = $2 AND ingredient_id = $3`,
          [avg, meal_id, ingredient_id]
        );

        // Also update recipe_ingredients so future plans that use this recipe
        // inherit the calibrated quantity.
        await client.query(
          `UPDATE recipe_ingredients ri
           SET quantity_per_person = $1
           FROM meal_menu_items mmi
           JOIN meals m ON mmi.meal_id = m.id
           WHERE ri.ingredient_id = $2
             AND mmi.recipe_id = ri.recipe_id
             AND m.id = $3`,
          [avg, ingredient_id, meal_id]
        );
      }
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

module.exports = router;
