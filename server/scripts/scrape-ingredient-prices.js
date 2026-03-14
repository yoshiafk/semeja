'use strict';
/**
 * scrape-ingredient-prices.js
 *
 * CLI script: scrape Jakarta market prices for all DB ingredients and write
 * a reviewable CSV to output/ingredient-prices-YYYY-MM-DD.csv.
 *
 * Usage (run from project root or server/):
 *   node server/scripts/scrape-ingredient-prices.js
 *
 * After reviewing the CSV:
 *   - Set approve_update = YES for rows you want to apply
 *   - Set approve_update = NO  for rows to skip
 *   - Then run: node server/scripts/import-ingredient-prices.js <path-to-csv>
 *
 * Columns:
 *   db_id                  – ingredient id in the database (or "NEW" for suggestions)
 *   db_name                – name as stored in the database
 *   db_category            – category (Pokok / Protein / Sayuran / Bumbu / Lainnya / Buah)
 *   db_unit                – unit as stored in the database
 *   db_current_price_idr   – current price_per_unit in the database (IDR)
 *   scraped_price_idr      – market price found from live/curated source (IDR)
 *   scraped_unit           – unit from the source (may differ from db_unit)
 *   match_confidence       – HIGH / MEDIUM / LOW
 *   price_change_pct       – percentage change vs current DB price
 *   scraped_source         – where the price came from
 *   scraped_raw_name       – exact name string from the source
 *   scraped_at             – ISO timestamp
 *   notes                  – market commentary, unit warnings, price range
 *   approve_update         – YES / REVIEW / NO  (edit this before importing)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const path = require('path');
const fs   = require('fs');
const { pool } = require('../db');
const scraper  = require('../lib/ingredient-price-scraper');

async function main() {
  const client = await pool.connect();
  let dbIngredients;

  try {
    const { rows } = await client.query(
      'SELECT id, name, unit, price_per_unit, category, price_last_updated_at, canonical_name FROM ingredients ORDER BY category, name',
    );
    dbIngredients = rows;
    console.log(`Loaded ${dbIngredients.length} ingredients from DB.`);
  } finally {
    client.release();
  }

  // Scrape live sources; curated fallback is automatically merged inside.
  const allPrices = await scraper.scrapeAllPrices();
  console.log(`Total price entries available for matching: ${allPrices.length}`);

  // Build CSV rows for existing DB ingredients
  const dbRows  = scraper.buildCSVRows(dbIngredients, allPrices);

  // Append new ingredient suggestions
  const newRows = scraper.buildNewSuggestionRows();

  const allRows = [...dbRows, ...newRows];

  // ---- Summary stats ----
  const autoYes    = allRows.filter((r) => r.approve_update === 'YES').length;
  const needReview = allRows.filter((r) => r.approve_update === 'REVIEW').length;
  const noMatch    = allRows.filter((r) => r.approve_update === 'NO').length;

  console.log(`\nMatching summary:`);
  console.log(`  Auto-approved (YES):   ${autoYes}`);
  console.log(`  Needs review (REVIEW): ${needReview}`);
  console.log(`  No price found (NO):   ${noMatch}`);
  console.log(`  New suggestions:       ${newRows.length}`);

  // ---- Write CSV ----
  const today     = new Date().toISOString().slice(0, 10);
  const outputDir = path.resolve(__dirname, '../../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csvPath = path.join(outputDir, `ingredient-prices-${today}.csv`);
  const csvContent = scraper.rowsToCSV(allRows);
  fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf8'); // BOM for Excel compatibility

  console.log(`\nCSV written to: ${csvPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Open the CSV in Excel / Google Sheets`);
  console.log(`  2. Review rows marked REVIEW — change approve_update to YES or NO`);
  console.log(`  3. For NEW rows: fill db_id as "NEW" and confirm approve_update = YES to insert`);
  console.log(`  4. Run: node server/scripts/import-ingredient-prices.js "${csvPath}"`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
