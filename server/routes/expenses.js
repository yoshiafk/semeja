const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Create a new expense with its splits
router.post('/', requireAuth, async (req, res) => {
  const { ledger_id, paid_by_member_id, amount, description, category, splits } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Expense
    const expenseRes = await client.query(
      `INSERT INTO expenses (ledger_id, paid_by_member_id, amount, description, category) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [ledger_id, paid_by_member_id, amount, description, category]
    );
    const expenseId = expenseRes.rows[0].id;

    // 2. Insert Splits
    // splits should be an array of { member_id, amount }
    if (splits && splits.length > 0) {
      let totalSplit = 0;
      for (const split of splits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount) VALUES ($1, $2, $3)`,
          [expenseId, split.member_id, split.amount]
        );
        totalSplit += split.amount;
      }

      // Sanity check
      if (totalSplit !== amount) {
        throw new Error(`Total split amounts (${totalSplit}) do not equal expense amount (${amount})`);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ id: expenseId, message: 'Expense created successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating expense:', err);
    res.status(500).json({ error: err.message || 'Failed to create expense' });
  } finally {
    client.release();
  }
});

// Get expenses by ledger id
router.get('/ledger/:ledger_id', async (req, res) => {
  const { ledger_id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT e.*, m.name as paid_by_name 
      FROM expenses e 
      LEFT JOIN members m ON e.paid_by_member_id = m.id
      WHERE ledger_id = $1 ORDER BY created_at DESC
    `, [ledger_id]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Delete an expense
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
