'use strict';
/**
 * import-ingredient-prices.js
 *
 * CLI script: read a reviewed CSV produced by scrape-ingredient-prices.js and
 * apply approved price updates to the database.
 *
 * Usage:
 *   node server/scripts/import-ingredient-prices.js <path-to-csv>
 *
 * Rules:
 *   approve_update = YES + db_id is numeric  → UPDATE ingredients SET price_per_unit, price_last_updated_at
 *   approve_update = YES + db_id = "NEW"     → INSERT new ingredient
 *   approve_update = REVIEW or NO            → skipped
 *
 * The entire import runs in a single transaction; any DB error triggers a full
 * rollback so you can fix the CSV and re-run safely.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const { pool } = require('../db');

// ---------------------------------------------------------------------------
// Minimal CSV parser (handles quoted fields with embedded commas / newlines)
// ---------------------------------------------------------------------------
function parseCSV(content) {
  // Strip UTF-8 BOM if present
  const text = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  const rows  = [];
  let   row   = [];
  let   field = '';
  let   inQ   = false;

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i];
    const next = text[i + 1];

    if (inQ) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"')             { inQ = false; }
      else                             { field += ch; }
    } else {
      if (ch === '"')                  { inQ = true; }
      else if (ch === ',')             { row.push(field); field = ''; }
      else if (ch === '\r' && next === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
      else if (ch === '\n' || ch === '\r')  { row.push(field); rows.push(row); row = []; field = ''; }
      else                             { field += ch; }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }

  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (r[i] ?? '').trim(); });
    return obj;
  });
}

// ---------------------------------------------------------------------------

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node server/scripts/import-ingredient-prices.js <path-to-csv>');
    process.exit(1);
  }

  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const rows    = parseCSV(fs.readFileSync(absPath, 'utf8'));
  const approved = rows.filter((r) => r.approve_update === 'YES');

  if (approved.length === 0) {
    console.log('No rows with approve_update = YES found. Nothing to import.');
    process.exit(0);
  }

  console.log(`Found ${approved.length} approved rows out of ${rows.length} total.`);

  const toUpdate = approved.filter((r) => /^\d+$/.test(r.db_id));
  const toInsert = approved.filter((r) => r.db_id === 'NEW');

  console.log(`  Updates (existing ingredients): ${toUpdate.length}`);
  console.log(`  Inserts (new ingredients):      ${toInsert.length}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let updated = 0;
    let inserted = 0;
    const errors = [];

    // ---- UPDATE existing ingredients ----
    for (const r of toUpdate) {
      const price = parseInt(r.scraped_price_idr, 10);
      if (isNaN(price) || price <= 0) {
        errors.push(`Row id=${r.db_id} (${r.db_name}): invalid price "${r.scraped_price_idr}" — skipped`);
        continue;
      }

      const shouldWriteCanonical = r.match_confidence === 'MEDIUM_JACCARD' && r.scraped_raw_name;
      const res = await client.query(
        shouldWriteCanonical
          ? `UPDATE ingredients SET price_per_unit=$1, price_last_updated_at=NOW(), canonical_name=$2 WHERE id=$3 RETURNING id, name`
          : `UPDATE ingredients SET price_per_unit=$1, price_last_updated_at=NOW() WHERE id=$2 RETURNING id, name`,
        shouldWriteCanonical
          ? [price, r.scraped_raw_name, parseInt(r.db_id, 10)]
          : [price, parseInt(r.db_id, 10)],
      );

      if (res.rowCount === 0) {
        errors.push(`Row id=${r.db_id} (${r.db_name}): no matching DB row — skipped`);
      } else {
        console.log(`  ✓ Updated  ${res.rows[0].name}: Rp${price}/${r.db_unit}`);
        updated++;
      }
    }

    // ---- INSERT new ingredients ----
    for (const r of toInsert) {
      const price    = parseInt(r.scraped_price_idr, 10);
      const name     = r.db_name?.trim();
      const unit     = r.db_unit?.trim();
      const category = r.db_category?.trim() || 'Lainnya';

      if (!name || !unit || isNaN(price) || price < 0) {
        errors.push(`NEW row "${r.db_name}": missing name/unit/price — skipped`);
        continue;
      }

      const res = await client.query(
        `INSERT INTO ingredients (name, unit, price_per_unit, category, price_last_updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (name) DO UPDATE
           SET price_per_unit = EXCLUDED.price_per_unit,
               unit           = EXCLUDED.unit,
               category       = EXCLUDED.category,
               price_last_updated_at = NOW()
         RETURNING id, name`,
        [name, unit, price, category],
      );
      console.log(`  ✓ Inserted ${res.rows[0].name} (id ${res.rows[0].id}): Rp${price}/${unit}`);
      inserted++;
    }

    await client.query('COMMIT');

    console.log(`\n✅ Import complete.`);
    console.log(`   Updated:  ${updated}`);
    console.log(`   Inserted: ${inserted}`);
    if (errors.length > 0) {
      console.log(`   Warnings (${errors.length}):`);
      errors.forEach((e) => console.log(`     ⚠ ${e}`));
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Import failed — transaction rolled back.');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
