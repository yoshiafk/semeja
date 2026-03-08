const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET full cost summary for a meal plan
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
      const { rows: manualIngredients } = await pool.query(
        `SELECT mi.*, i.name, i.unit, i.price_per_unit, i.stock_quantity, i.category
         FROM meal_ingredients mi
         JOIN ingredients i ON mi.ingredient_id = i.id
         WHERE mi.meal_id = $1`,
        [meal.id]
      );
      
      manualIngredients.forEach(ing => processIngredient(ing, ing.meal_type));

      // 4. Process Recipe Ingredients (Main Course - Lauk)
      if (meal.main_course_recipe_id) {
         const { rows: mainRecipeIngs } = await pool.query(
            `SELECT ri.*, i.price_per_unit, i.stock_quantity, i.category,
                    COALESCE(i.unit, ri.custom_unit) as unit
             FROM recipe_ingredients ri
             LEFT JOIN ingredients i ON ri.ingredient_id = i.id
             WHERE ri.recipe_id = $1`,
            [meal.main_course_recipe_id]
         );
         mainRecipeIngs.forEach(ing => processIngredient(ing, 'main'));
      }

      // 5. Process Recipe Ingredients (Second Course - Sayur)
      if (meal.second_course_recipe_id) {
         const { rows: secondRecipeIngs } = await pool.query(
            `SELECT ri.*, i.price_per_unit, i.stock_quantity, i.category,
                    COALESCE(i.unit, ri.custom_unit) as unit
             FROM recipe_ingredients ri
             LEFT JOIN ingredients i ON ri.ingredient_id = i.id
             WHERE ri.recipe_id = $1`,
            [meal.second_course_recipe_id]
         );
         secondRecipeIngs.forEach(ing => processIngredient(ing, 'second'));
      }

      // 6. Process Recipe Ingredients (Dessert - Pencuci Mulut)
      if (meal.dessert_recipe_id) {
         const { rows: dessertRecipeIngs } = await pool.query(
            `SELECT ri.*, i.price_per_unit, i.stock_quantity, i.category,
                    COALESCE(i.unit, ri.custom_unit) as unit
             FROM recipe_ingredients ri
             LEFT JOIN ingredients i ON ri.ingredient_id = i.id
             WHERE ri.recipe_id = $1`,
            [meal.dessert_recipe_id]
         );
         dessertRecipeIngs.forEach(ing => processIngredient(ing, 'dessert'));
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
    for (const item of formattedShoppingList) {
       let cheapestSupplier = null;
       
       if (item.ingredient_id) {
           const { rows: supplierRows } = await pool.query(
               `SELECT p.price_per_unit, s.name as supplier_name 
                FROM purchases p
                JOIN suppliers s ON p.supplier_id = s.id
                WHERE p.ingredient_id = $1
                ORDER BY p.price_per_unit ASC
                LIMIT 1`,
               [item.ingredient_id]
           );
           
           if (supplierRows.length > 0) {
               cheapestSupplier = supplierRows[0].supplier_name;
               // Optionally, if the user wants to use the cheapest historical price instead of the master ingredient price:
               // Decide whether to override cost_to_buy based on historical best price or keep master price.
               // We'll just provide the supplier name here as a hint.
           }
       }
       
       finalShoppingList.push({
           ...item,
           cheapest_supplier: cheapestSupplier
       });
    }

    // Subtotal of only things we ACTUALLY need to buy (using master item price)
    const totalShoppingCost = finalShoppingList.reduce((acc, curr) => acc + curr.cost_to_buy, 0);

    // The 'week_total' represents raw consumption value. We'll return it, but also return 'total_shopping_cost'
    res.json({
      week_total: Math.round(weekTotal),
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
