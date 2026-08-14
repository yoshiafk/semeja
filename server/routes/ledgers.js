const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all ledgers
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ledgers ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching ledgers:', err);
    res.status(500).json({ error: 'Failed to fetch ledgers' });
  }
});

// Get a specific ledger by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM ledgers WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ledger not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching ledger:', err);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

// Get ledger by reference (e.g. meal_plan or trip)
router.get('/by-reference/:type/:refId', async (req, res) => {
  const { type, refId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ledgers WHERE type = $1 AND reference_id = $2 LIMIT 1',
      [type, refId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ledger not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching ledger by reference:', err);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

// Get ledger summary (balances)
router.get('/:id/summary', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Get all expenses for this ledger
    const expensesRes = await pool.query(`
      SELECT e.id, e.amount, e.paid_by_member_id, e.description, e.category, e.created_at, e.receipt_id,
             m.name as paid_by_name
      FROM expenses e
      LEFT JOIN members m ON e.paid_by_member_id = m.id
      WHERE e.ledger_id = $1
      ORDER BY e.created_at DESC
    `, [id]);
    
    // 2. Get all splits for these expenses
    const splitsRes = await pool.query(`
      SELECT s.expense_id, s.member_id, s.amount, m.name
      FROM expense_splits s
      JOIN expenses e ON s.expense_id = e.id
      JOIN members m ON s.member_id = m.id
      WHERE e.ledger_id = $1
    `, [id]);

    // 3. Get all settlements
    const settlementsRes = await pool.query(`
      SELECT s.id, s.payer_id, s.payee_id, s.amount, s.created_at,
             payer.name as payer_name, payee.name as payee_name
      FROM settlements s
      LEFT JOIN members payer ON s.payer_id = payer.id
      LEFT JOIN members payee ON s.payee_id = payee.id
      WHERE s.ledger_id = $1
      ORDER BY s.created_at DESC
    `, [id]);

    // 4. Calculate Balances
    // Balance > 0 means the person is owed money
    // Balance < 0 means the person owes money
    const balances = {};
    const memberNames = {};

    // First initialize from splits (they owe money)
    for (const split of splitsRes.rows) {
      if (!balances[split.member_id]) {
        balances[split.member_id] = 0;
        memberNames[split.member_id] = split.name;
      }
      balances[split.member_id] -= split.amount;
    }

    // Then add from expenses (they paid money, so they are owed)
    for (const exp of expensesRes.rows) {
      if (exp.paid_by_member_id) {
        if (!balances[exp.paid_by_member_id]) {
          balances[exp.paid_by_member_id] = 0;
          memberNames[exp.paid_by_member_id] = exp.paid_by_name;
        }
        balances[exp.paid_by_member_id] += exp.amount;
      }
    }

    // Apply settlements
    for (const st of settlementsRes.rows) {
      // Payer's balance goes UP (they are paying back their debt)
      if (st.payer_id) {
        if (!balances[st.payer_id]) {
            balances[st.payer_id] = 0;
            memberNames[st.payer_id] = st.payer_name;
        }
        balances[st.payer_id] += st.amount;
      }
      // Payee's balance goes DOWN (they received the money they were owed)
      if (st.payee_id) {
        if (!balances[st.payee_id]) {
            balances[st.payee_id] = 0;
            memberNames[st.payee_id] = st.payee_name;
        }
        balances[st.payee_id] -= st.amount;
      }
    }

    const memberBalances = Object.keys(balances).map(memberId => ({
      member_id: parseInt(memberId),
      name: memberNames[memberId],
      balance: balances[memberId]
    }));

    res.json({
      expenses: expensesRes.rows,
      splits: splitsRes.rows,
      settlements: settlementsRes.rows,
      balances: memberBalances
    });

  } catch (err) {
    console.error('Error generating ledger summary:', err);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

module.exports = router;
