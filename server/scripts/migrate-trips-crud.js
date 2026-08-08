const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding is_done to trip_schedule_items...');
    await client.query(`
      ALTER TABLE trip_schedule_items 
      ADD COLUMN IF NOT EXISTS is_done BOOLEAN DEFAULT false;
    `);

    console.log('Adding actual_amount_rp to trip_budget_rows...');
    await client.query(`
      ALTER TABLE trip_budget_rows 
      ADD COLUMN IF NOT EXISTS actual_amount_rp INTEGER DEFAULT 0;
    `);

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
