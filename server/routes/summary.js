const express = require('express');
const router = express.Router();
const { pool } = require('../db');

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
      
      // Batch fetch recipe ingredients
      const allRecipeIds = [...new Set([
        ...meals.map(m => m.main_course_recipe_id),
        ...meals.map(m => m.second_course_recipe_id),
        ...meals.map(m => m.dessert_recipe_id)
      ].filter(id => id != null))];
      
      let allRecipeIngredients = [];
      if (allRecipeIds.length > 0) {
        const { rows } = await pool.query(
          `SELECT ri.*, i.price_per_unit, i.name
           FROM recipe_ingredients ri
           LEFT JOIN ingredients i ON ri.ingredient_id = i.id
           WHERE ri.recipe_id = ANY($1::int[])`,
          [allRecipeIds]
        );
        allRecipeIngredients = rows;
      }
      
      // Calculate cost for each meal the member joined
      const memberMealIds = participations.map(p => p.meal_id);
      
      for (const meal of meals) {
        const pCount = parseInt(meal.participant_count) || 0;
        if (pCount === 0) continue;
        
        let dayCost = 0;
        
        // Calculate ingredients cost
        const processRecipeIngredients = (recipeId) => {
          if (!recipeId) return;
          const ings = allRecipeIngredients.filter(i => i.recipe_id === recipeId && i.name !== 'Beras');
          ings.forEach(ing => {
            const qtyPerPerson = parseFloat(ing.quantity_per_person) || parseFloat(ing.amount_per_person) || 0;
            const totalQty = qtyPerPerson * pCount;
            const pricePerUnit = parseFloat(ing.price_per_unit) || 0;
            dayCost += totalQty * pricePerUnit;
          });
        };
        
        processRecipeIngredients(meal.main_course_recipe_id);
        processRecipeIngredients(meal.second_course_recipe_id);
        processRecipeIngredients(meal.dessert_recipe_id);
        
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
      
      currentWeek = {
        mealPlanId: plan.id,
        weekLabel,
        daysJoined: participations.length,
        estimatedCost,
        actualCost,
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
      `SELECT m.*,
        (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
       FROM meals m WHERE m.meal_plan_id = $1 ORDER BY m.date`,
      [planId]
    );

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

    // --- BATCH FETCH ALL REQUIRED DATA TO AVOID N+1 QUERIES ---
    let manualIngredientRows = [];
    const mealIds = meals.map(m => m.id);
    if (mealIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT mi.*, i.name, i.unit, i.price_per_unit, i.stock_quantity, i.category
         FROM meal_ingredients mi
         JOIN ingredients i ON mi.ingredient_id = i.id
         WHERE mi.meal_id = ANY($1::int[])`,
        [mealIds]
      );
      manualIngredientRows = rows;
    }

    const mainRecipeIds = meals.map(m => m.main_course_recipe_id).filter(id => id != null);
    const secondRecipeIds = meals.map(m => m.second_course_recipe_id).filter(id => id != null);
    const dessertRecipeIds = meals.map(m => m.dessert_recipe_id).filter(id => id != null);
    const allRecipeIds = [...new Set([...mainRecipeIds, ...secondRecipeIds, ...dessertRecipeIds])];

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

      // Helper function to process an ingredient payload
      const processIngredient = (ingData, mealType) => {
        const qtyPerPerson = parseFloat(ingData.quantity_per_person) || parseFloat(ingData.amount_per_person) || 0;
        const totalQty = qtyPerPerson * pCount;
        
        // Cost estimation: if it's linked to the DB, use DB price. Else fallback to 0.
        const pricePerUnit = parseFloat(ingData.price_per_unit) || 0;
        const cost = totalQty * pricePerUnit;
        dayCost += cost;

        const name = ingData.name;
        const unit = ingData.unit || ingData.custom_unit || 'secukupnya';
        const expectedStock = parseFloat(ingData.stock_quantity) || 0;

        dayIngredients.push({
          name,
          unit,
          quantity_per_person: qtyPerPerson,
          total_quantity: totalQty,
          price_per_unit: pricePerUnit,
          total_cost: Math.round(cost),
          meal_type: mealType,
        });

        // Add to shopping list aggregate
        // For external recipes, they might not have a formal ingredient ID if parsing failed to link one
        const key = ingData.ingredient_id ? `ing_${ingData.ingredient_id}` : `str_${name}_${unit}`;
        
        if (!shoppingList[key]) {
          shoppingList[key] = {
            ingredient_id: ingData.ingredient_id,
            name,
            unit,
            total_quantity: 0,
            total_cost: 0,
            price_per_unit: pricePerUnit,
            stock_quantity: expectedStock,
            category: ingData.category || 'Lainnya'
          };
        }
        shoppingList[key].total_quantity += totalQty;
        shoppingList[key].total_cost += Math.round(cost);
      };

      // 3. Process Manual Ingredients (meal_ingredients)
      const manualIngredients = manualIngredientRows.filter(ing => ing.meal_id === meal.id);
      manualIngredients.forEach(ing => processIngredient(ing, ing.meal_type));

      // 4. Process Recipe Ingredients (Main Course - Lauk)
      if (meal.main_course_recipe_id) {
         const mainRecipeIngs = allRecipeIngredients.filter(ing => ing.recipe_id === meal.main_course_recipe_id);
         mainRecipeIngs.forEach(ing => {
            // Skip 'Beras' from recipes as it's now handled by the global toggle
            if (ing.name === 'Beras') return;
            processIngredient(ing, 'main');
         });
      }

      // 5. Process Recipe Ingredients (Second Course - Sayur)
      if (meal.second_course_recipe_id) {
         const secondRecipeIngs = allRecipeIngredients.filter(ing => ing.recipe_id === meal.second_course_recipe_id);
         secondRecipeIngs.forEach(ing => {
            // Skip 'Beras' from recipes as it's now handled by the global toggle
            if (ing.name === 'Beras') return;
            processIngredient(ing, 'second');
         });
      }

      // 6. Process Recipe Ingredients (Dessert - Pencuci Mulut)
      if (meal.dessert_recipe_id) {
         const dessertRecipeIngs = allRecipeIngredients.filter(ing => ing.recipe_id === meal.dessert_recipe_id);
         dessertRecipeIngs.forEach(ing => {
            // Skip 'Beras' from recipes as it's now handled by the global toggle
            if (ing.name === 'Beras') return;
            processIngredient(ing, 'dessert');
         });
      }

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
        main_course_menu: meal.main_course_menu,
        second_course_menu: meal.second_course_menu,
        dessert_menu: meal.dessert_menu,
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
    });

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

    // The 'week_total' represents raw consumption value. We'll return it, but also return 'total_shopping_cost'
    res.json({
      week_total: Math.round(weekTotal),
      total_actual_cost: totalActualCost,
      total_shopping_cost: Math.round(totalShoppingCost),
      daily_breakdown: dailyBreakdown,
      member_totals: Object.values(memberTotals),
      shopping_list: finalShoppingList,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
