const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { convertToWeight } = require('../lib/units');

// GET member-specific cost summary
router.get('/member/:memberId', async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    
    // 1. Get member info
    const { rows: memberRows } = await pool.query(
      'SELECT id, name, role FROM members WHERE id = $1',
      [memberId]
    );
    
    if (memberRows.length === 0) {
      return res.status(404).json({ error: 'Member tidak ditemukan' });
    }
    
    const member = memberRows[0];
    
    // 2. Get active meal plan
    const { rows: activePlans } = await pool.query(
      "SELECT * FROM meal_plans WHERE status = 'active' ORDER BY week_start DESC LIMIT 1"
    );
    
    let currentWeek = null;
    
    if (activePlans.length > 0) {
      const plan = activePlans[0];
      const weekStart = new Date(plan.week_start);
      const weekEnd = new Date(plan.week_end);
      
      // Format week label (e.g., "10 - 16 Mar 2026")
      const formatDate = (d) => d.getDate();
      const formatMonth = (d) => d.toLocaleDateString('id-ID', { month: 'short' });
      const formatYear = (d) => d.getFullYear();
      const weekLabel = `${formatDate(weekStart)} - ${formatDate(weekEnd)} ${formatMonth(weekEnd)} ${formatYear(weekEnd)}`;
      
      // 3. Get member's participations for this plan
      const { rows: participations } = await pool.query(
        `SELECT p.*, m.date, m.day_name 
         FROM participations p
         JOIN meals m ON p.meal_id = m.id
         WHERE m.meal_plan_id = $1 AND p.member_id = $2
         ORDER BY m.date`,
        [plan.id, memberId]
      );
      
      // 4. Calculate costs per day using the same logic as main summary
      const dailyBreakdown = [];
      let estimatedCost = 0;
      let actualCost = 0;
      
      // Get all meals for this plan with costs
      const { rows: meals } = await pool.query(
        `SELECT m.*,
          (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
         FROM meals m WHERE m.meal_plan_id = $1 ORDER BY m.date`,
        [plan.id]
      );
      
      // Get Beras for rice calculation
      const { rows: riceRows } = await pool.query(
        "SELECT id as ingredient_id, price_per_unit FROM ingredients WHERE name = 'Beras' LIMIT 1"
      );
      const riceIngredient = riceRows[0];
      
      // 3. Get all meal ingredients for this plan (using as single source of truth)
      const { rows: allMealIngredients } = await pool.query(
        `SELECT mi.*, i.price_per_unit, i.name, i.unit as base_unit
         FROM meal_ingredients mi
         JOIN ingredients i ON mi.ingredient_id = i.id
         WHERE mi.meal_id = ANY(SELECT id FROM meals WHERE meal_plan_id = $1)`,
        [plan.id]
      );
      
      // 4. Calculate cost for each meal the member joined
      const memberMealIds = participations.map(p => p.meal_id);
      
      for (const meal of meals) {
        const pCount = parseInt(meal.participant_count) || 0;
        if (pCount === 0) continue;
        
        let dayCost = 0;
        
        // Calculate ingredients cost from meal_ingredients
        const currentMealIngs = allMealIngredients.filter(i => i.meal_id === meal.id);
        currentMealIngs.forEach(ing => {
          if (ing.name === 'Beras') return;
          const qtyPerPerson = parseFloat(ing.quantity_per_person) || 0;
          const totalQty = qtyPerPerson * pCount;
          const pricePerUnit = parseFloat(ing.price_per_unit) || 0;
          
          // Fix: Use weight-converted quantity for cost estimation
          const weightQty = convertToWeight(totalQty, ing.unit || ing.base_unit || 'secukupnya', ing.name);
          dayCost += weightQty * pricePerUnit;
        });
        
        // Add rice if required
        if (meal.requires_rice && riceIngredient) {
          const riceQty = 0.15 * pCount;
          dayCost += riceQty * (parseFloat(riceIngredient.price_per_unit) || 0);
        }
        
        const costPerPerson = Math.round(dayCost / pCount);
        
        // Only add to breakdown if member participated
        if (memberMealIds.includes(meal.id)) {
          const participation = participations.find(p => p.meal_id === meal.id);
          dailyBreakdown.push({
            date: meal.date,
            dayName: meal.day_name,
            costPerPerson: costPerPerson
          });
          estimatedCost += costPerPerson;
        }
      }
      
      // 5. Calculate actual cost share
      const { rows: purchaseSumObj } = await pool.query(
        `SELECT SUM(total_price) as actual_shopping_cost FROM purchases WHERE meal_plan_id = $1`,
        [plan.id]
      );
      const totalActualCost = parseInt(purchaseSumObj[0]?.actual_shopping_cost) || 0;
      
      // Get total portions across all members
      const { rows: totalPortions } = await pool.query(
        `SELECT COUNT(*) as total FROM participations p
         JOIN meals m ON p.meal_id = m.id
         WHERE m.meal_plan_id = $1`,
        [plan.id]
      );
      const totalSystemPortions = parseInt(totalPortions[0]?.total) || 0;
      
      if (totalSystemPortions > 0 && participations.length > 0) {
        actualCost = Math.round((totalActualCost / totalSystemPortions) * participations.length);
      }
      
      // 5.5 Calculate Activity Costs for this member within the current week timeframe
      let activityCost = 0;
      const { rows: activityParticipations } = await pool.query(
        `SELECT ap.guests_count, a.cost_amount, a.cost_type,
           (SELECT SUM(1 + ap2.guests_count) FROM activity_participations ap2 WHERE ap2.activity_id = a.id) as total_people
         FROM activity_participations ap
         JOIN activities a ON ap.activity_id = a.id
         WHERE ap.member_id = $1 
         AND a.date >= $2 AND a.date <= $3`,
        [memberId, plan.week_start, plan.week_end]
      );

      for (const act of activityParticipations) {
        const myHeadcount = 1 + (act.guests_count || 0);
        const actCost = parseFloat(act.cost_amount) || 0;
        
        if (act.cost_type === 'fixed') {
          activityCost += actCost * myHeadcount;
        } else if (act.cost_type === 'split') {
          const totalPeople = parseInt(act.total_people) || 1; // avoid division by zero
          activityCost += Math.round((actCost / totalPeople) * myHeadcount);
        }
      }
      
      currentWeek = {
        mealPlanId: plan.id,
        weekLabel,
        daysJoined: participations.length,
        estimatedCost,
        actualCost,
        activityCost,
        dailyBreakdown
      };
    }
    
    // 6. Calculate historical data from archived plans
    const { rows: historyData } = await pool.query(
      `SELECT 
         COUNT(DISTINCT mp.id) as total_weeks,
         COUNT(p.id) as total_days,
         COALESCE(SUM(
           CASE WHEN purch.total_cost > 0 
           THEN (purch.total_cost::float / NULLIF(purch.total_portions, 0))
           ELSE 0 END
         ), 0) as total_cost
       FROM meal_plans mp
       LEFT JOIN meals m ON m.meal_plan_id = mp.id
       LEFT JOIN participations p ON p.meal_id = m.id AND p.member_id = $1
       LEFT JOIN (
         SELECT meal_plan_id, 
                SUM(total_price) as total_cost,
                (SELECT COUNT(*) FROM participations p2 
                 JOIN meals m2 ON p2.meal_id = m2.id 
                 WHERE m2.meal_plan_id = purchases.meal_plan_id) as total_portions
         FROM purchases
         GROUP BY meal_plan_id
       ) purch ON purch.meal_plan_id = mp.id
       WHERE mp.status = 'archived' AND p.id IS NOT NULL`,
      [memberId]
    );
    
    const history = {
      totalWeeks: parseInt(historyData[0]?.total_weeks) || 0,
      totalCost: Math.round(parseFloat(historyData[0]?.total_cost) || 0),
      totalDays: parseInt(historyData[0]?.total_days) || 0,
      averageWeekly: 0
    };
    
    if (history.totalWeeks > 0) {
      history.averageWeekly = Math.round(history.totalCost / history.totalWeeks);
    }
    
    res.json({
      member,
      currentWeek,
      history
    });
    
  } catch (err) {
    console.error('Member summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET full cost summary for a meal plan
router.get('/:mealPlanId', async (req, res) => {
  try {
    const planId = req.params.mealPlanId;

    // 1. Get all meals with participant counts
    const { rows: meals } = await pool.query(
      `SELECT m.*, mp.week_start, mp.week_end,
        (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
       FROM meals m 
       JOIN meal_plans mp ON m.meal_plan_id = mp.id
       WHERE m.meal_plan_id = $1 ORDER BY m.date`,
      [planId]
    );

    const weekStart = meals.length > 0 ? meals[0].week_start : null;
    const weekEnd = meals.length > 0 ? meals[0].week_end : null;

    // 1.5 Get Beras ingredient for auto-rice calculation
    const { rows: riceRows } = await pool.query(
      "SELECT id as ingredient_id, name, unit, price_per_unit, stock_quantity, category FROM ingredients WHERE name = 'Beras' LIMIT 1"
    );
    const riceIngredient = riceRows[0];

    // 2. Get all participations with member info
    const { rows: participations } = await pool.query(
      `SELECT p.meal_id, p.member_id, mb.name as member_name
       FROM participations p
       JOIN members mb ON p.member_id = mb.id
       JOIN meals m ON p.meal_id = m.id
       WHERE m.meal_plan_id = $1`,
      [planId]
    );

    const dailyBreakdown = [];
    const memberTotals = {};
    const shoppingList = {};
    let weekTotal = 0;

    let manualIngredientRows = [];
    const mealIds = meals.map(m => m.id);
    let mealMenuItems = [];
    if (mealIds.length > 0) {
      const { rows: ingredients } = await pool.query(
        `SELECT mi.*, i.name, i.unit as base_unit, i.price_per_unit, i.stock_quantity, i.category
         FROM meal_ingredients mi
         JOIN ingredients i ON mi.ingredient_id = i.id
         WHERE mi.meal_id = ANY($1::int[])`,
        [mealIds]
      );
      manualIngredientRows = ingredients;

      const { rows: items } = await pool.query(
        'SELECT * FROM meal_menu_items WHERE meal_id = ANY($1::int[]) ORDER BY sort_order ASC',
        [mealIds]
      );
      mealMenuItems = items;
    }

    const allRecipeIds = [...new Set(mealMenuItems.map(it => it.recipe_id).filter(id => id != null))];

    let allRecipeIngredients = [];
    if (allRecipeIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT ri.*, i.price_per_unit, i.stock_quantity, i.category,
                COALESCE(i.unit, ri.custom_unit) as unit
         FROM recipe_ingredients ri
         LEFT JOIN ingredients i ON ri.ingredient_id = i.id
         WHERE ri.recipe_id = ANY($1::int[])`,
        [allRecipeIds]
      );
      allRecipeIngredients = rows;
    }
    // ----------------------------------------------------------

    for (const meal of meals) {
      const pCount = parseInt(meal.participant_count) || 0;
      let dayCost = 0;
      const dayIngredients = [];

      // Skip aggregating ingredients if this day has no menus at all
      const hasAnyMenu = meal.main_course_recipe_id || meal.second_course_recipe_id || meal.dessert_recipe_id || 
                          manualIngredientRows.some(ing => ing.meal_id === meal.id);
      
      if (!hasAnyMenu) {
        // Still add to daily breakdown but with zero costs
        dailyBreakdown.push({
          meal_id: meal.id,
          date: meal.date,
          day_name: meal.day_name,
          main_course_menu: meal.main_course_menu,
          second_course_menu: meal.second_course_menu,
          dessert_menu: meal.dessert_menu,
          participant_count: pCount,
          total_cost: 0,
          cost_per_person: 0,
          ingredients: [],
        });
        continue; // Skip ingredient processing for this day
      }

      // Helper function to process an ingredient payload
      const processIngredient = (ingData, mealType) => {
        const qtyPerPerson = parseFloat(ingData.quantity_per_person) || 0;
        const totalQty = qtyPerPerson * pCount;
        const displayUnit = ingData.unit || ingData.base_unit || 'secukupnya';
        
        // Cost estimation: Convert to weight before applying price
        const pricePerUnit = parseFloat(ingData.price_per_unit) || 0;
        const weightQty = convertToWeight(totalQty, displayUnit, ingData.name);
        const cost = weightQty * pricePerUnit;
        dayCost += cost;

        const name = ingData.name;
        // mi.unit is the custom unit (e.g. siung), base_unit is from ingredients table (e.g. kg)
        const expectedStock = parseFloat(ingData.stock_quantity) || 0;

        dayIngredients.push({
          name,
          unit: displayUnit,
          quantity_per_person: qtyPerPerson,
          total_quantity: totalQty,
          price_per_unit: pricePerUnit,
          total_cost: Math.round(cost),
          meal_type: mealType,
        });

        // Add to shopping list aggregate - using Unit Conversion for weight
        const key = ingData.ingredient_id ? `ing_${ingData.ingredient_id}` : `str_${name}_${displayUnit}`;
        
        if (!shoppingList[key]) {
          shoppingList[key] = {
            ingredient_id: ingData.ingredient_id,
            name,
            unit: ingData.base_unit || displayUnit, // Shopping list should use base unit (kg/liter)
            total_quantity: 0,
            total_cost: 0,
            price_per_unit: pricePerUnit,
            stock_quantity: expectedStock,
            category: ingData.category || 'Lainnya'
          };
        }
        shoppingList[key].total_quantity += weightQty;
        shoppingList[key].total_cost += Math.round(cost);
      };

      // 3. Process Manual Ingredients (meal_ingredients)
      const manualIngredients = manualIngredientRows.filter(ing => ing.meal_id === meal.id);
      manualIngredients.forEach(ing => processIngredient(ing, ing.meal_type));

      // 4. Process Recipe Ingredients - now handled via meal_ingredients only
      const currentMealItems = mealMenuItems.filter(it => it.meal_id === meal.id);

      // 6.5 Add Rice (Beras) if required for this meal
      if (meal.requires_rice && riceIngredient) {
        processIngredient({
          ...riceIngredient,
          quantity_per_person: 0.15 // 150g per person
        }, 'rice');
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
        items: currentMealItems,
        main_course_menu: currentMealItems.filter(i => i.category === 'main').map(i => i.custom_name || 'Resep').join(', '),
        second_course_menu: currentMealItems.filter(i => i.category === 'second').map(i => i.custom_name || 'Resep').join(', '),
        dessert_menu: currentMealItems.filter(i => i.category === 'dessert').map(i => i.custom_name || 'Resep').join(', '),
        participant_count: pCount,
        total_cost: Math.round(dayCost),
        cost_per_person: costPerPerson,
        ingredients: dayIngredients,
      });
    }

    // 7. Calculate Actual Costs based on Purchases
    const { rows: purchaseSumObj } = await pool.query(
      `SELECT SUM(total_price) as actual_shopping_cost FROM purchases WHERE meal_plan_id = $1`,
      [planId]
    );
    const totalActualCost = parseInt(purchaseSumObj[0]?.actual_shopping_cost) || 0;
    
    // Distribute actual cost fairly based on portions
    let totalSystemPortions = 0;
    Object.values(memberTotals).forEach(m => totalSystemPortions += m.days_joined);

    const actualCostPerPortion = totalSystemPortions > 0 ? (totalActualCost / totalSystemPortions) : 0;
    
    Object.keys(memberTotals).forEach(member_id => {
      memberTotals[member_id].actual_total = Math.round(memberTotals[member_id].days_joined * actualCostPerPortion);
      memberTotals[member_id].activity_total = 0; // Initialize activity total
    });

    // 7.5 Add Activity Costs for the week
    let totalActivityCost = 0;
    if (weekStart && weekEnd) {
      const { rows: activities } = await pool.query(
        `SELECT a.id, a.cost_type, a.cost_amount, ap.member_id, ap.guests_count,
           (SELECT SUM(1 + ap2.guests_count) FROM activity_participations ap2 WHERE ap2.activity_id = a.id) as total_people
         FROM activities a
         JOIN activity_participations ap ON a.id = ap.activity_id
         WHERE a.date >= $1 AND a.date <= $2`,
        [weekStart, weekEnd]
      );

      for (const act of activities) {
        const myHeadcount = 1 + (act.guests_count || 0);
        const actCost = parseFloat(act.cost_amount) || 0;
        let myShare = 0;

        if (act.cost_type === 'fixed') {
          myShare = actCost * myHeadcount;
        } else if (act.cost_type === 'split') {
          const totalPeople = parseInt(act.total_people) || 1;
          myShare = Math.round((actCost / totalPeople) * myHeadcount);
        }

        if (!memberTotals[act.member_id]) {
          // It's possible a member joined an activity but no meals
          const { rows: memberInfo } = await pool.query('SELECT name FROM members WHERE id = $1', [act.member_id]);
          if (memberInfo.length > 0) {
            memberTotals[act.member_id] = { 
              member_id: act.member_id, 
              name: memberInfo[0].name, 
              days_joined: 0, 
              total: 0, 
              actual_total: 0,
              activity_total: 0 
            };
          }
        }
        
        if (memberTotals[act.member_id]) {
          memberTotals[act.member_id].activity_total += myShare;
          totalActivityCost += myShare;
        }
      }
    }

    // Convert shopping list object to array and calculate exact shortage (to buy)
    const formattedShoppingList = Object.values(shoppingList).map(item => {
       // If stock > total_quantity, shortage is 0 (we have enough). 
       // Otherwise, shortage = total_quantity - stock
       let shortage = 0;
       if (item.total_quantity > 0) {
           shortage = Math.max(0, item.total_quantity - item.stock_quantity);
       }
       
       // Recalculate cost based ONLY on the shortage (what we actually need to buy)
       const costToBuy = shortage * item.price_per_unit;
       
       return {
         ...item,
         shortage_quantity: Number(shortage.toFixed(2)),
         total_quantity: Number(item.total_quantity.toFixed(2)),
         cost_to_buy: Math.round(costToBuy),
         has_enough_stock: shortage === 0 && item.total_quantity > 0,
         is_untracked: item.unit === 'secukupnya' || item.price_per_unit === 0
       };
    }).sort((a, b) => {
       // Sort by category first, then name
       if (a.category !== b.category) {
           return (a.category || "z").localeCompare(b.category || "z");
       }
       return a.name.localeCompare(b.name);
    });

    // Get cheapest suppliers for the required ingredients
    const finalShoppingList = [];
    const ingredientIdsToFetch = formattedShoppingList.map(item => item.ingredient_id).filter(id => id != null);
    
    const supplierMap = {};
    if (ingredientIdsToFetch.length > 0) {
        const { rows: supplierRows } = await pool.query(
            `SELECT DISTINCT ON (p.ingredient_id) 
                p.ingredient_id, p.price_per_unit, s.name as supplier_name 
             FROM purchases p
             JOIN suppliers s ON p.supplier_id = s.id
             WHERE p.ingredient_id = ANY($1::int[])
             ORDER BY p.ingredient_id, p.price_per_unit ASC, p.purchased_at DESC`,
            [ingredientIdsToFetch]
        );
        supplierRows.forEach(row => {
            supplierMap[row.ingredient_id] = row.supplier_name;
        });
    }

    for (const item of formattedShoppingList) {
       finalShoppingList.push({
           ...item,
           cheapest_supplier: item.ingredient_id ? (supplierMap[item.ingredient_id] || null) : null
       });
    }

    // Subtotal of only things we ACTUALLY need to buy (using master item price)
    const totalShoppingCost = finalShoppingList.reduce((acc, curr) => acc + curr.cost_to_buy, 0);

    // 7.8 Get individual purchases for the week
    const { rows: purchasesForWeek } = await pool.query(`
      SELECT p.*, s.name as supplier_name, i.name as ingredient_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      JOIN ingredients i ON p.ingredient_id = i.id
      WHERE p.meal_plan_id = $1
      ORDER BY p.purchased_at DESC, p.created_at DESC
    `, [planId]);

    // The 'week_total' represents raw consumption value. We'll return it, but also return 'total_shopping_cost'
    res.json({
      week_total: Math.round(weekTotal),
      total_actual_cost: totalActualCost,
      total_shopping_cost: Math.round(totalShoppingCost),
      total_activity_cost: totalActivityCost,
      daily_breakdown: dailyBreakdown,
      member_totals: Object.values(memberTotals),
      shopping_list: finalShoppingList,
      purchases: purchasesForWeek
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
