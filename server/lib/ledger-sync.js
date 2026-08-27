const { pool } = require('../db');

async function syncPurchaseToLedger(purchaseId, clientOrPool = pool) {
  // Delete existing expense for this purchase
  await clientOrPool.query(`DELETE FROM expenses WHERE metadata->>'purchase_id' = $1`, [purchaseId.toString()]);
  
  // Get purchase details
  const { rows: pRows } = await clientOrPool.query(`
    SELECT p.*, i.name as ingredient_name, mp.id as meal_plan_id
    FROM purchases p
    JOIN ingredients i ON p.ingredient_id = i.id
    LEFT JOIN meals m ON p.meal_id = m.id
    LEFT JOIN meal_plans mp ON (m.meal_plan_id = mp.id OR p.meal_plan_id = mp.id)
    WHERE p.id = $1
  `, [purchaseId]);
  
  if (pRows.length === 0) return;
  const p = pRows[0];
  if (!p.meal_plan_id) return;

  // Get ledger
  const { rows: lRows } = await clientOrPool.query(`SELECT id FROM ledgers WHERE type = 'meal_plan' AND reference_id = $1`, [p.meal_plan_id]);
  if (lRows.length === 0) return;
  const ledgerId = lRows[0].id;

  // Create expense
  const amount = parseInt(p.total_price);
  const { rows: eRows } = await clientOrPool.query(`
    INSERT INTO expenses (ledger_id, description, amount, paid_by_member_id, category, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [
    ledgerId, 
    `Belanja: ${p.ingredient_name}`, 
    amount, 
    p.member_id, 
    'groceries', 
    JSON.stringify({ purchase_id: p.id, quantity: p.quantity })
  ]);
  const expenseId = eRows[0].id;

  // Assignments
  const { rows: assignments } = await clientOrPool.query(`SELECT meal_id, amount FROM purchase_assignments WHERE purchase_id = $1`, [p.id]);
  
  let mealSplits = [];
  if (assignments.length > 0) {
    mealSplits = assignments;
  } else if (p.meal_id) {
    mealSplits = [{ meal_id: p.meal_id, amount: amount }];
  } else {
    // Shared across the whole meal plan (equally among all who joined at least 1 meal)
    const { rows: allMembers } = await clientOrPool.query(`
      SELECT DISTINCT member_id FROM participations p
      JOIN meals m ON p.meal_id = m.id
      WHERE m.meal_plan_id = $1
    `, [p.meal_plan_id]);
    if (allMembers.length > 0) {
      const splitAmount = Math.round(amount / allMembers.length);
      for (const mem of allMembers) {
        await clientOrPool.query(`
          INSERT INTO expense_splits (expense_id, member_id, amount, split_type)
          VALUES ($1, $2, $3, 'exact')
        `, [expenseId, mem.member_id, splitAmount]);
      }
    }
    return;
  }

  // Split by meal participations
  const splitsByMember = {};
  for (const assignment of mealSplits) {
    const mealId = assignment.meal_id;
    const mealAmount = parseInt(assignment.amount);
    
    const { rows: participants } = await clientOrPool.query(`SELECT member_id FROM participations WHERE meal_id = $1`, [mealId]);
    if (participants.length > 0) {
      const splitAmount = Math.floor(mealAmount / participants.length);
      for (const p of participants) {
        splitsByMember[p.member_id] = (splitsByMember[p.member_id] || 0) + splitAmount;
      }
    }
  }

  // Insert splits
  for (const [member_id, splitAmount] of Object.entries(splitsByMember)) {
    await clientOrPool.query(`
      INSERT INTO expense_splits (expense_id, member_id, amount, split_type)
      VALUES ($1, $2, $3, 'exact')
    `, [expenseId, member_id, splitAmount]);
  }
}

async function removePurchaseFromLedger(purchaseId, clientOrPool = pool) {
  await clientOrPool.query(`DELETE FROM expenses WHERE metadata->>'purchase_id' = $1`, [purchaseId.toString()]);
}

module.exports = { syncPurchaseToLedger, removePurchaseFromLedger };
