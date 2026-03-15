/**
 * server/lib/snapshot.js
 * Created when a meal plan transitions to 'shopping' status.
 * Captures the current shopping list as a snapshot so retroactive recipe changes
 * don't affect what the buyer was told to purchase.
 */

const { convertToWeight } = require('./units');

/**
 * @param {object} pool - pg pool instance
 * @param {number} planId - meal_plans.id
 */
async function createShoppingListSnapshot(pool, planId) {
  // Get all ingredients for all meals in this plan
  const { rows: ingredients } = await pool.query(
    `SELECT mi.*, i.name, i.unit as base_unit, i.price_per_unit,
            i.stock_quantity, i.category, i.id as ingredient_id
     FROM meal_ingredients mi
     JOIN ingredients i ON mi.ingredient_id = i.id
     JOIN meals m ON mi.meal_id = m.id
     WHERE m.meal_plan_id = $1`,
    [planId]
  );

  // Get all meals with participant counts
  const { rows: meals } = await pool.query(
    `SELECT m.id, m.requires_rice,
            COUNT(p.id)::int as participant_count
     FROM meals m
     LEFT JOIN participations p ON p.meal_id = m.id
     WHERE m.meal_plan_id = $1
     GROUP BY m.id`,
    [planId]
  );

  // Get rice price
  const { rows: riceRows } = await pool.query(
    "SELECT id as ingredient_id, name, unit, price_per_unit, stock_quantity, category FROM ingredients WHERE name = 'Beras' LIMIT 1"
  );
  const riceIngredient = riceRows[0] || null;

  // Aggregate quantities across all meals
  const snapshot = {};

  for (const meal of meals) {
    const pCount = parseInt(meal.participant_count) || 0;
    if (pCount === 0) continue;

    const mealIngs = ingredients.filter(i => i.meal_id === meal.id);

    for (const ing of mealIngs) {
      const qtyPerPerson = parseFloat(ing.quantity_per_person) || 0;
      const totalQty = qtyPerPerson * pCount;
      const displayUnit = ing.unit || ing.base_unit || 'secukupnya';
      const weightQty = convertToWeight(totalQty, displayUnit, ing.name);
      const pricePerUnit = parseFloat(ing.price_per_unit) || 0;

      const key = `ing_${ing.ingredient_id}`;
      if (!snapshot[key]) {
        snapshot[key] = {
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          unit: ing.base_unit || displayUnit,
          total_quantity: 0,
          estimated_cost: 0,
          stock_quantity: parseFloat(ing.stock_quantity) || 0,
          price_per_unit: pricePerUnit,
          category: ing.category || 'Lainnya',
        };
      }
      snapshot[key].total_quantity += weightQty;
      snapshot[key].estimated_cost += Math.round(weightQty * pricePerUnit);
    }

    // Rice
    if (meal.requires_rice && riceIngredient) {
      const riceQty = 0.15 * pCount;
      const key = `ing_${riceIngredient.ingredient_id}`;
      if (!snapshot[key]) {
        snapshot[key] = {
          ingredient_id: riceIngredient.ingredient_id,
          name: riceIngredient.name,
          unit: riceIngredient.unit || 'kg',
          total_quantity: 0,
          estimated_cost: 0,
          stock_quantity: parseFloat(riceIngredient.stock_quantity) || 0,
          price_per_unit: parseFloat(riceIngredient.price_per_unit) || 0,
          category: riceIngredient.category || 'Karbohidrat',
        };
      }
      snapshot[key].total_quantity += riceQty;
      snapshot[key].estimated_cost += Math.round(riceQty * parseFloat(riceIngredient.price_per_unit || 0));
    }
  }

  // Get cheapest suppliers
  const ingredientIds = Object.values(snapshot).map(i => i.ingredient_id).filter(Boolean);
  const supplierMap = {};
  if (ingredientIds.length > 0) {
    const { rows: supplierRows } = await pool.query(
      `SELECT DISTINCT ON (p.ingredient_id)
         p.ingredient_id, s.name as supplier_name
       FROM purchases p
       JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.ingredient_id = ANY($1::int[])
       ORDER BY p.ingredient_id, p.price_per_unit ASC`,
      [ingredientIds]
    );
    supplierRows.forEach(r => { supplierMap[r.ingredient_id] = r.supplier_name; });
  }

  // Upsert snapshot rows (shortage = total needed - stock on hand)
  for (const item of Object.values(snapshot)) {
    const shortage = Math.max(0, item.total_quantity - item.stock_quantity);
    await pool.query(
      `INSERT INTO shopping_list_snapshots
         (meal_plan_id, ingredient_id, ingredient_name, quantity, unit, estimated_cost, cheapest_supplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (meal_plan_id, ingredient_id)
       DO UPDATE SET
         ingredient_name   = EXCLUDED.ingredient_name,
         quantity          = EXCLUDED.quantity,
         estimated_cost    = EXCLUDED.estimated_cost,
         cheapest_supplier = EXCLUDED.cheapest_supplier,
         snapshotted_at    = NOW()`,
      [planId, item.ingredient_id, item.name,
       Number(shortage.toFixed(3)), item.unit,
       item.estimated_cost, supplierMap[item.ingredient_id] || null]
    );
  }
}

module.exports = { createShoppingListSnapshot };
