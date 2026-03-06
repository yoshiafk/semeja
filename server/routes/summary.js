const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET full cost summary for a meal plan
router.get('/:mealPlanId', async (req, res) => {
  try {
    const planId = req.params.mealPlanId;

    // Get all meals with participant counts
    const { rows: meals } = await pool.query(
      `SELECT m.*,
        (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
       FROM meals m WHERE m.meal_plan_id = $1 ORDER BY m.date`,
      [planId]
    );

    // Get all participations with member info
    const { rows: participations } = await pool.query(
      `SELECT p.meal_id, p.member_id, mb.name as member_name
       FROM participations p
       JOIN members mb ON p.member_id = mb.id
       JOIN meals m ON p.meal_id = m.id
       WHERE m.meal_plan_id = $1`,
      [planId]
    );

    // Calculate costs per meal
    const dailyBreakdown = [];
    const memberTotals = {};
    const shoppingList = {};
    let weekTotal = 0;

    for (const meal of meals) {
      const pCount = parseInt(meal.participant_count) || 0;

      // Get meal ingredients
      const { rows: ingredients } = await pool.query(
        `SELECT mi.*, i.name, i.unit, i.price_per_unit
         FROM meal_ingredients mi
         JOIN ingredients i ON mi.ingredient_id = i.id
         WHERE mi.meal_id = $1`,
        [meal.id]
      );

      let dayCost = 0;
      const dayIngredients = [];

      for (const ing of ingredients) {
        const qtyPerPerson = parseFloat(ing.quantity_per_person);
        const totalQty = qtyPerPerson * pCount;
        const cost = totalQty * ing.price_per_unit;
        dayCost += cost;

        dayIngredients.push({
          name: ing.name,
          unit: ing.unit,
          quantity_per_person: qtyPerPerson,
          total_quantity: totalQty,
          price_per_unit: ing.price_per_unit,
          total_cost: Math.round(cost),
          meal_type: ing.meal_type,
        });

        // Aggregate shopping list
        const key = `${ing.name}_${ing.unit}`;
        if (!shoppingList[key]) {
          shoppingList[key] = {
            name: ing.name,
            unit: ing.unit,
            total_quantity: 0,
            total_cost: 0,
            price_per_unit: ing.price_per_unit,
          };
        }
        shoppingList[key].total_quantity += totalQty;
        shoppingList[key].total_cost += Math.round(cost);
      }

      const costPerPerson = pCount > 0 ? Math.round(dayCost / pCount) : 0;
      weekTotal += dayCost;

      // Assign cost to each participant
      const dayParticipants = participations.filter(p => p.meal_id === meal.id);
      for (const p of dayParticipants) {
        if (!memberTotals[p.member_id]) {
          memberTotals[p.member_id] = { member_id: p.member_id, name: p.member_name, days_joined: 0, total: 0 };
        }
        memberTotals[p.member_id].days_joined += 1;
        memberTotals[p.member_id].total += costPerPerson;
      }

      dailyBreakdown.push({
        meal_id: meal.id,
        date: meal.date,
        day_name: meal.day_name,
        lunch_menu: meal.lunch_menu,
        dinner_menu: meal.dinner_menu,
        participant_count: pCount,
        total_cost: Math.round(dayCost),
        cost_per_person: costPerPerson,
        ingredients: dayIngredients,
      });
    }

    res.json({
      week_total: Math.round(weekTotal),
      daily_breakdown: dailyBreakdown,
      member_totals: Object.values(memberTotals),
      shopping_list: Object.values(shoppingList).sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
