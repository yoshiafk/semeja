'use strict';
/**
 * price-updater-cron.js
 *
 * Weekly cron job that scrapes Jakarta market ingredient prices and writes a
 * dated CSV to the output/ directory.
 *
 * Schedule: Every Sunday at 06:00 WIB (UTC+7) → cron expression "0 23 * * 6" (UTC)
 *
 * Optional auto-import:
 *   Set env var AUTO_IMPORT_HIGH_CONFIDENCE=true to automatically apply all
 *   HIGH-confidence matches (approve_update = YES) without manual CSV review.
 *   Leave unset (default) to write CSV only and require manual import.
 *
 * Manual trigger (bypass schedule, run once immediately):
 *   node server/scripts/price-updater-cron.js --run-now
 *
 * Required dependency: node-cron  (in server/package.json)
 */

const path = require('path');
const fs   = require('fs');
const cron = require('node-cron');
const { pool }  = require('../db');
const scraper   = require('../lib/ingredient-price-scraper');

const AUTO_IMPORT = process.env.AUTO_IMPORT_HIGH_CONFIDENCE === 'true';
const RUN_NOW     = process.argv.includes('--run-now');

// ---------------------------------------------------------------------------

async function runPriceUpdate() {
  console.log(`[price-updater] Starting price update run — ${new Date().toISOString()}`);

  let dbIngredients;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, name, unit, price_per_unit, category, price_last_updated_at FROM ingredients ORDER BY category, name',
    );
    dbIngredients = rows;
  } finally {
    client.release();
  }

  const allPrices = await scraper.scrapeAllPrices();
  const dbRows    = scraper.buildCSVRows(dbIngredients, allPrices);
  const newRows   = scraper.buildNewSuggestionRows();
  const allRows   = [...dbRows, ...newRows];

  // Write CSV
  const today     = new Date().toISOString().slice(0, 10);
  const outputDir = path.resolve(__dirname, '../../output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const csvPath   = path.join(outputDir, `ingredient-prices-${today}.csv`);
  fs.writeFileSync(csvPath, '\uFEFF' + scraper.rowsToCSV(allRows), 'utf8');
  console.log(`[price-updater] CSV written → ${csvPath}`);

  // Optional auto-import of HIGH-confidence rows
  if (AUTO_IMPORT) {
    console.log('[price-updater] AUTO_IMPORT_HIGH_CONFIDENCE=true — applying HIGH confidence updates…');
    const autoRows = allRows.filter(
      (r) => r.approve_update === 'YES' && /^\d+$/.test(String(r.db_id)),
    );

    if (autoRows.length === 0) {
      console.log('[price-updater] No auto-importable rows found.');
      return;
    }

    const importClient = await pool.connect();
    try {
      await importClient.query('BEGIN');
      let count = 0;
      for (const r of autoRows) {
        const price = parseInt(r.scraped_price_idr, 10);
        if (isNaN(price) || price <= 0) continue;
        await importClient.query(
          `UPDATE ingredients SET price_per_unit = $1, price_last_updated_at = NOW() WHERE id = $2`,
          [price, parseInt(r.db_id, 10)],
        );
        count++;
      }
      await importClient.query('COMMIT');
      console.log(`[price-updater] Auto-imported ${count} HIGH-confidence price updates.`);
    } catch (err) {
      await importClient.query('ROLLBACK');
      console.error('[price-updater] Auto-import failed, rolled back:', err.message);
    } finally {
      importClient.release();
    }
  } else {
    console.log('[price-updater] CSV ready for manual review. Set AUTO_IMPORT_HIGH_CONFIDENCE=true to auto-apply.');
  }

  console.log(`[price-updater] Run complete — ${new Date().toISOString()}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (RUN_NOW) {
  // Immediate single run (used for testing / manual trigger)
  runPriceUpdate().catch((err) => {
    console.error('[price-updater] Fatal error:', err);
    process.exit(1);
  });
} else {
  // Schedule: every Sunday at 06:00 WIB = 23:00 Saturday UTC
  // Cron syntax: minute hour day-of-month month day-of-week
  const CRON_SCHEDULE = '0 23 * * 6';
  cron.schedule(CRON_SCHEDULE, () => {
    runPriceUpdate().catch((err) => {
      console.error('[price-updater] Scheduled run error:', err.message);
    });
  }, { timezone: 'UTC' });

  console.log(`[price-updater] Cron job registered — fires every Sunday 06:00 WIB (${CRON_SCHEDULE} UTC)`);
  console.log(`[price-updater] Run manually any time: node server/scripts/price-updater-cron.js --run-now`);
}

module.exports = { runPriceUpdate };
