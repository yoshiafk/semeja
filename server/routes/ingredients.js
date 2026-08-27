const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const scraper = require('../lib/ingredient-price-scraper');

// GET all ingredients (optional category filter)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM ingredients ORDER BY category, name';
    let params = [];
    if (category) {
      query = 'SELECT * FROM ingredients WHERE category = $1 ORDER BY name';
      params = [category];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new ingredient
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, unit, price_per_unit, category, stock_quantity, min_stock_threshold } = req.body;
  if (!name || !unit || !price_per_unit) {
    return res.status(400).json({ error: 'name, unit, and price_per_unit are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO ingredients (name, unit, price_per_unit, category, stock_quantity, min_stock_threshold) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (name) DO UPDATE SET 
         unit = EXCLUDED.unit,
         price_per_unit = EXCLUDED.price_per_unit,
         category = CASE WHEN ingredients.category = '' THEN EXCLUDED.category ELSE ingredients.category END,
         price_last_updated_at = NOW()
       RETURNING *`,
      [name.trim(), unit, price_per_unit, category || '', stock_quantity || 0, min_stock_threshold || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update ingredient
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, unit, price_per_unit, category, stock_quantity, min_stock_threshold } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE ingredients SET 
        name = COALESCE($1, name), 
        unit = COALESCE($2, unit), 
        price_per_unit = COALESCE($3, price_per_unit), 
        category = COALESCE($4, category),
        stock_quantity = COALESCE($5, stock_quantity),
        min_stock_threshold = COALESCE($6, min_stock_threshold)
       WHERE id = $7 RETURNING *`,
      [name, unit, price_per_unit, category, stock_quantity, min_stock_threshold, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ingredient
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM ingredients WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT adjust stock
router.put('/:id/stock', requireAuth, requireAdmin, async (req, res) => {
  const { adjustment, type } = req.body; // type: 'restock' | 'consume'
  
  if (typeof adjustment !== 'number' || !['restock', 'consume'].includes(type)) {
    return res.status(400).json({ error: 'Valid adjustment number and type (restock|consume) are required' });
  }

  try {
    const query = type === 'restock'
      ? `UPDATE ingredients SET 
          stock_quantity = stock_quantity + $1,
          last_restocked = NOW()
         WHERE id = $2 RETURNING *`
      : `UPDATE ingredients SET 
          stock_quantity = GREATEST(0, stock_quantity - $1)
         WHERE id = $2 RETURNING *`;

    const { rows } = await pool.query(query, [Math.abs(adjustment), req.params.id]);
    
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST sync prices from all market sources
router.post('/sync-prices', requireAuth, requireAdmin, async (req, res) => {
  const threshold = typeof req.body.threshold === 'number' ? req.body.threshold : 30;

  try {
    // Only process ingredients with stale prices (NULL or >7 days old) to stay under 10s Vercel limit
    const { rows: dbIngredients } = await pool.query(
      `SELECT id, name, unit, price_per_unit, category, price_last_updated_at, canonical_name 
       FROM ingredients 
       WHERE price_last_updated_at IS NULL OR price_last_updated_at < NOW() - INTERVAL '7 days'
       ORDER BY category, name
       LIMIT 150`,
    );

    const allPrices = await scraper.scrapeAllPrices();

    const toUpdate    = [];   // { id, price, canonical_name? }
    const toFlagged   = [];   // items with large price swings
    const toNormalized = [];  // MEDIUM_JACCARD — user confirmation needed
    let skipped       = 0;
    let auto_normalized = 0;
    const sourcesUsed = new Set();

    for (const ing of dbIngredients) {
      const match = scraper.findBestMatch(ing, allPrices);
      if (!match) { skipped++; continue; }

      const { item, confidence, similarity, fromJaccard } = match;
      sourcesUsed.add(item.source);

      const price = Number(item.price);
      if (!Number.isFinite(price)) {
        skipped++;
        continue;
      }
      const roundedPrice = Math.round(price);

      const changePct = ing.price_per_unit > 0
        ? ((roundedPrice - ing.price_per_unit) / ing.price_per_unit) * 100
        : null;

      if (confidence === 'MEDIUM_JACCARD') {
        toNormalized.push({
          id:                 ing.id,
          current_name:       ing.name,
          suggested_canonical: item.rawName,
          similarity:         Math.round(similarity * 100) / 100,
          scraped_price:      roundedPrice,
          current_price:      ing.price_per_unit,
          source:             item.source,
        });
        continue;
      }

      // HIGH or MEDIUM: route by price change threshold
      const absChange = changePct !== null ? Math.abs(changePct) : 0;
      if (changePct !== null && absChange > threshold) {
        toFlagged.push({
          id:         ing.id,
          name:       ing.name,
          unit:       ing.unit,
          old_price:  ing.price_per_unit,
          new_price:  roundedPrice,
          change_pct: (changePct >= 0 ? '+' : '') + changePct.toFixed(1) + '%',
          source:     item.source,
        });
        continue;
      }

      const updateItem = { id: ing.id, price: roundedPrice };
      // Tier 3 HIGH match → auto-register canonical_name if not already set
      if (fromJaccard && !ing.canonical_name) {
        updateItem.canonical_name = item.rawName;
        auto_normalized++;
      }
      toUpdate.push(updateItem);
    }

    // Apply all updates in a single batch transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      if (toUpdate.length > 0) {
        // Build single UPDATE query with CASE statements for batch update
        const ids = toUpdate.map(u => u.id);
        const priceCase = toUpdate.map((u, i) => `WHEN ${u.id} THEN $${i + 1}::int`).join(' ');
        
        const withCanonical = toUpdate.filter(u => u.canonical_name);
        const canonicalCase = withCanonical
          .map((u, i) => `WHEN ${u.id} THEN $${toUpdate.length + i + 1}`)
          .join(' ');
          
        const params = [
          ...toUpdate.map(u => Number(u.price)),
          ...withCanonical.map(u => u.canonical_name),
        ];
        
        const canonicalUpdate = canonicalCase
          ? `, canonical_name = CASE id ${canonicalCase} ELSE canonical_name END`
          : '';
        
        await client.query(
          `UPDATE ingredients 
           SET price_per_unit = CASE id ${priceCase} END,
               price_last_updated_at = NOW()
               ${canonicalUpdate}
           WHERE id = ANY($${params.length + 1})`,
          [...params, ids],
        );
      }
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      updated:           toUpdate.length,
      auto_normalized,
      flagged:           toFlagged,
      normalized:        toNormalized,
      skipped,
      sources_used:      [...sourcesUsed],
      threshold_pct:     threshold,
      total_ingredients: dbIngredients.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST force-apply a reviewed list of prices (flagged items)
router.post('/set-prices', requireAuth, requireAdmin, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let applied = 0;
    for (const { id, price } of items) {
      const p = parseInt(price, 10);
      if (!id || isNaN(p) || p < 0) continue;
      const { rowCount } = await client.query(
        'UPDATE ingredients SET price_per_unit=$1, price_last_updated_at=NOW() WHERE id=$2',
        [p, id],
      );
      if (rowCount > 0) applied++;
    }
    await client.query('COMMIT');
    res.json({ applied });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST confirm user-reviewed name normalizations (MEDIUM_JACCARD matches)
router.post('/apply-normalizations', requireAuth, requireAdmin, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let applied = 0;
    for (const { id, canonical_name, price } of items) {
      const p = parseInt(price, 10);
      if (!id || !canonical_name || isNaN(p) || p < 0) continue;
      const { rowCount } = await client.query(
        `UPDATE ingredients
            SET canonical_name = $1, price_per_unit = $2, price_last_updated_at = NOW()
          WHERE id = $3`,
        [canonical_name, p, id],
      );
      if (rowCount > 0) applied++;
    }
    await client.query('COMMIT');
    res.json({ applied });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
