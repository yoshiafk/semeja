const { pool, initDB } = require('../db');

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Creating new unified ledger tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ledgers (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL, -- 'meal_plan', 'trip', 'general'
        reference_id INTEGER, -- FK to meal_plans.id or trips.id
        title VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ledger_members (
        id SERIAL PRIMARY KEY,
        ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(ledger_id, member_id)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE,
        paid_by_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        amount INTEGER NOT NULL,
        description VARCHAR(300) NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        receipt_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
        reference_type VARCHAR(50), -- e.g. 'purchase', 'activity', 'gift', 'trip_budget'
        reference_id INTEGER, -- original ID for traceability
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS expense_splits (
        id SERIAL PRIMARY KEY,
        expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        UNIQUE(expense_id, member_id)
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE,
        payer_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        payee_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Migrating meal_plans to ledgers...');
    const mealPlansRes = await client.query('SELECT id, week_start, week_end FROM meal_plans');
    const mealPlans = mealPlansRes.rows;

    for (const mp of mealPlans) {
      // Check if ledger already exists
      const existingRes = await client.query('SELECT id FROM ledgers WHERE type = $1 AND reference_id = $2', ['meal_plan', mp.id]);
      if (existingRes.rows.length > 0) {
        console.log(`Ledger for meal plan ${mp.id} already exists. Skipping.`);
        continue;
      }

      // Create ledger for meal plan
      const title = `Meal Plan Week ${mp.week_start.toISOString().split('T')[0]}`;
      const ledgerRes = await client.query(
        'INSERT INTO ledgers (type, reference_id, title) VALUES ($1, $2, $3) RETURNING id',
        ['meal_plan', mp.id, title]
      );
      const ledgerId = ledgerRes.rows[0].id;

      // Find participants for this meal plan to add to ledger_members
      const membersRes = await client.query(`
        SELECT DISTINCT member_id 
        FROM participations p 
        JOIN meals m ON p.meal_id = m.id 
        WHERE m.meal_plan_id = $1
      `, [mp.id]);
      
      for (const row of membersRes.rows) {
        await client.query(
          'INSERT INTO ledger_members (ledger_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [ledgerId, row.member_id]
        );
      }

      // Migrate purchases
      const purchasesRes = await client.query(`
        SELECT p.*, i.name as ingredient_name 
        FROM purchases p 
        JOIN ingredients i ON p.ingredient_id = i.id 
        WHERE p.meal_plan_id = $1
      `, [mp.id]);
      
      for (const pur of purchasesRes.rows) {
        const expenseRes = await client.query(`
          INSERT INTO expenses (ledger_id, paid_by_member_id, amount, description, category, receipt_id, reference_type, reference_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `, [
          ledgerId, 
          pur.member_id, 
          pur.total_price, 
          `Beli ${pur.ingredient_name}`, 
          'groceries', 
          pur.receipt_id, 
          'purchase', 
          pur.id
        ]);
        const expenseId = expenseRes.rows[0].id;

        // For purchases, split equally among all meal plan participants
        // (Legacy logic split exact purchase assignment, but usually it was by meal participants)
        // Here we just pull from purchase_assignments if exists, or fallback
        const assignmentsRes = await client.query(`
          SELECT pa.meal_id, pa.amount 
          FROM purchase_assignments pa 
          WHERE pa.purchase_id = $1
        `, [pur.id]);

        let totalAssignedToMeals = 0;
        let mealSplits = {}; // member_id -> amount

        if (assignmentsRes.rows.length > 0) {
          for (const a of assignmentsRes.rows) {
            // Find who participated in this meal
            const mealParts = await client.query('SELECT member_id FROM participations WHERE meal_id = $1', [a.meal_id]);
            if (mealParts.rows.length > 0) {
              const perPerson = Math.floor(a.amount / mealParts.rows.length);
              for (const p of mealParts.rows) {
                mealSplits[p.member_id] = (mealSplits[p.member_id] || 0) + perPerson;
              }
            }
          }
        } else {
           // Default fallback: split equally across all meal participants who joined this meal plan
           if (membersRes.rows.length > 0) {
             const perPerson = Math.floor(pur.total_price / membersRes.rows.length);
             for (const p of membersRes.rows) {
               mealSplits[p.member_id] = perPerson;
             }
           }
        }

        // Insert splits
        for (const [mid, amount] of Object.entries(mealSplits)) {
          await client.query(`
            INSERT INTO expense_splits (expense_id, member_id, amount) VALUES ($1, $2, $3)
          `, [expenseId, mid, amount]);
        }
      }

      // Migrate payment_records to settlements
      const paymentsRes = await client.query(`
        SELECT * FROM payment_records WHERE meal_plan_id = $1
      `, [mp.id]);

      // In legacy, payments didn't have a payee (it was assumed paid to the 'admin' or communal pot)
      // We'll set payee_id to null or the admin (we'll just use the confirmed_by if available, else null)
      for (const pay of paymentsRes.rows) {
        if (!pay.confirmed_by) continue; // need a payee in Splitwise model
        await client.query(`
          INSERT INTO settlements (ledger_id, payer_id, payee_id, amount, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [ledgerId, pay.member_id, pay.confirmed_by, pay.amount, pay.paid_at]);
      }
    }

    console.log('Migrating trips to ledgers...');
    const tripsRes = await client.query('SELECT id, title FROM trips');
    const trips = tripsRes.rows;

    for (const t of trips) {
      // Check if ledger already exists
      const existingRes = await client.query('SELECT id FROM ledgers WHERE type = $1 AND reference_id = $2', ['trip', t.id]);
      if (existingRes.rows.length > 0) {
        console.log(`Ledger for trip ${t.id} already exists. Skipping.`);
        continue;
      }

      // Create ledger for trip
      const title = `Trip ${t.title}`;
      const ledgerRes = await client.query(
        'INSERT INTO ledgers (type, reference_id, title) VALUES ($1, $2, $3) RETURNING id',
        ['trip', t.id, title]
      );
      const ledgerId = ledgerRes.rows[0].id;

      // Find participants for this trip to add to ledger_members
      const membersRes = await client.query(`
        SELECT member_id 
        FROM trip_participations 
        WHERE trip_id = $1
      `, [t.id]);
      
      for (const row of membersRes.rows) {
        await client.query(
          'INSERT INTO ledger_members (ledger_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [ledgerId, row.member_id]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
  }
}

module.exports = { migrate };

// If run directly via CLI
if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
