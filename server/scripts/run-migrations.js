#!/usr/bin/env node
/**
 * Run all 5 database migrations in order.
 * Safe to re-run: uses IF NOT EXISTS and IF EXISTS everywhere.
 * Usage:  node server/scripts/run-migrations.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const migrations = [
  '001_purchases_meal_id.sql',
  '002_meal_plans_lifecycle.sql',
  '003_shopping_list_snapshots.sql',
  '004_plan_reactions.sql',
  '005_payment_records.sql',
];

async function run() {
  const client = await pool.connect();
  try {
    for (const file of migrations) {
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`▶ Running ${file}…`);
      await client.query(sql);
      console.log(`  ✓ Done`);
    }
    console.log('\n✅ All migrations applied successfully.');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
