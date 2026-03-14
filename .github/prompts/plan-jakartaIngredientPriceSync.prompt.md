# Plan: Jakarta Ingredient Price Scraper + Name Normalization

## Overview
Build a multi-source price scraping pipeline targeting Jakarta traditional market prices for Indonesian cuisine ingredients. Scrapes from official government sources and marketplaces (Tokopedia, Sayurbox, Superindo), exposes a "Sync Harga" button in the UI for admins, and auto-updates prices within a configurable threshold. Includes `price_last_updated_at` and `canonical_name` columns. Adds Jaccard/Overlap-based name normalization so any user-added ingredient is automatically matched to its market name on first sync — no manual alias needed. Price syncing is triggered entirely by the admin "Sync Harga" button; there is no cron job.

---

## Phase 1: DB Migration

**File:** `server/db.js`
- Add `price_last_updated_at TIMESTAMP` (already done)
- Add `canonical_name VARCHAR(150)` — stores the market-side matched name for unaliased user-coined ingredients; never shown in the UI; used as a Tier 2 fast-path alias on all future syncs

Both added via `ALTER TABLE IF NOT EXISTS … ADD COLUMN IF NOT EXISTS` inside the existing `initializeDatabase()` migration block.

---

## Phase 2: Shared Scraper Module

**File:** `server/lib/ingredient-price-scraper.js`

### Sources (priority order)
1. **hargapangan.id** — PIHPS National (Badan Pangan Nasional)
   - REST API: `https://panelharga.badanpangan.go.id/data/province-avg-by-date?province_id=31&level_pasar=1`
   - HTML fallback: `https://hargapangan.id/tabel-harga/pasar-tradisional/daerah`
   - Covers ~18 strategic commodities (beras, gula, minyak goreng, bawang, cabai, daging, telur, ikan, garam)
2. **infopangan.jakarta.go.id** — Jakarta city government DKPKP portal
   - JSON API: `https://infopangan.jakarta.go.id/publik/api/getkomoditi`
   - HTML fallback on public page
   - Covers ~35+ commodities including sayuran, buah, bumbu
3. **Tokopedia** — largest Indonesian marketplace
   - ACE REST API: `https://ace.tokopedia.com/search/product/v3?q=...`
   - `__NEXT_DATA__` SSR fallback
   - Queried for 15 volatile/high-value items (bawang, cabai, daging, telur, ayam, udang)
4. **Sayurbox** — Jakarta fresh-produce delivery marketplace
   - Catalog JSON API: `https://www.sayurbox.com/api/v1/products?category=sayuran-buah`
   - `__NEXT_DATA__` per-item fallback
   - Covers fresh vegetables and fruit
5. **Superindo Online** — supermarket chain (upper-bound cross-check)
   - JSON API + HTML `__NEXT_DATA__` + CSS price selector fallback
6. **Curated fallback dataset** — embedded March 2026 Jakarta prices
   - Packaged goods (kecap, santan instan, mie instan, bumbu sachet, etc.)
   - Rare spices and items unavailable from live sources
   - Research basis: Pasar Induk Kramat Jati, infopangan.jakarta historical data, BPS DKI Q1 2026

### Name Mapping Table (`NAME_ALIASES`)
DB ingredient name → [scraped aliases (lowercase)]; covers all existing DB ingredients.
Example:
```
"Beras IR. I (IR 64)" → ["beras ir64", "beras medium", "beras lokal", "beras"]
"Ayam Negeri"         → ["daging ayam ras", "ayam broiler", "ayam negeri", "ayam ras"]
"Cabai Merah Keriting"→ ["cabai merah keriting", "cabe merah keriting"]
"Telur Ayam Ras"      → ["telur ayam ras", "telur ayam"]
"Minyak Goreng …"     → ["minyak goreng curah", "minyak goreng kemasan", "minyak goreng"]
```

### Name Normalization — `normalizeForMatching(str)`
Best-practice preprocessing pipeline (pure JS, zero deps):
1. Lowercase + NFKD normalize → strip combining diacritical marks
2. Strip punctuation (`/`, `.`, `(`, `)`, `;`) → spaces
3. Strip embedded quantity+unit noise (`500g`, `1kg`, `250ml`, `pcs`, `per`)
4. Remove noise adjectives via Set lookup (O(1)):
   - `segar, lokal, impor, curah, kemasan, organik, premium, pilihan`
   - `siap, masak, murah, higienis, sachet, botolan, cair`
   - `iris, kupas, cincang, parut, potong, mentah, matang`
5. Synonym normalization (whole-word regex):
   - `cabe → cabai` (most common variant)
   - `mie → mi`
   - `pete → petai`
6. Collapse whitespace + trim
7. Fallback: if result is empty after stripping, return original lowercased

Why this matters: `"Wortel Segar Pilihan"` → `"wortel"`, which hits an exact token match against the scraped `"wortel"` with no fuzzy math needed.

### Similarity Scoring — `computeSimilarity(a, b)`

Formula: `score = max(Jaccard(A, B), OverlapCoefficient(A, B))`
Both computed on **preprocessed token sets** (output of `normalizeForMatching`).

- `Jaccard(A,B) = |A∩B| / |A∪B|`
- `OverlapCoefficient(A,B) = |A∩B| / min(|A|, |B|)` — asymmetric; correctly handles name subsets/supersets

**Why the hybrid (not pure Jaccard):**
| Comparison | Jaccard | Overlap | Score | Correct? |
|---|---|---|---|---|
| "wortel" vs "wortel segar" | 0.50 | 1.00 | 1.00 | ✓ (same thing) |
| "bawang merah" vs "bawang merah keriting" | 0.67 | 1.00 | 1.00 | ✓ |
| "bawang merah" vs "bawang bombay" | 0.33 | 0.50 | 0.50 | ✓ (below threshold; surfaced for review) |
| "kacang panjang" vs "kacang tanah" | 0.33 | 0.50 | 0.50 | ✓ (below auto-apply) |

**Thresholds (calibrated for Indonesian food names):**
| Score | Confidence | Routing |
|---|---|---|
| ≥ 0.65 | `HIGH` | Auto-apply price + register `canonical_name` |
| 0.45 – 0.64 | `MEDIUM_JACCARD` | User confirmation queue (`normalized[]`) |
| < 0.45 | no match | Skipped |

Threshold of 0.45 (not 0.35) prevents "bawang merah ↔ bawang bombay" (score 0.50) from being auto-applied while still surfacing it for review.

### Updated `findBestMatch()` — 3-Tier Lookup

**Tier 1 — Exact alias (fastest):** `NAME_ALIASES[ing.name]` exists → compare normalized scraped names → return `HIGH`, similarity=1.0. Covers all existing aliases.

**Tier 2 — Canonical fast-path:** If `ing.canonical_name` is set → use as alias array → exact comparison → return `HIGH`, similarity=1.0. Converts the one-time Jaccard match into a permanent O(1) lookup; no Jaccard re-computation on future syncs.

**Tier 3 — Jaccard/Overlap fallback:** Only reached for new/unaliased ingredients. Runs `computeSimilarity(ing.name, scraped.rawName)` for every scraped item, tracks best score, returns best match with `{ item, confidence, similarity }` where confidence is `HIGH` (≥0.65) or `MEDIUM_JACCARD` (0.45–0.64).

`MEDIUM_JACCARD` is a new confidence value distinct from the existing `MEDIUM` (substring match). It routes to the normalization queue, not the price-update queue.

### Unit Normalization
- `per 100g` / `per ons` → × 10 → `kg`
- `per gram` → × 1000 → `kg`
- `buah` → `pcs`
- Identity: `liter`, `kg`, `ikat`, `pack`, `bungkus`

### Merge Priority
`hargapangan > infopangan > Tokopedia > Sayurbox > Superindo > curated`
(first occurrence per normalised rawName wins)

### Exported Functions
- `scrapeHargaPangan()` → `[{ rawName, price, unit, source }]`
- `scrapeInfoPanganJakarta()` → same
- `scrapeTokopedia()` → same
- `scrapeSayurbox()` → same
- `scrapeSuperindo()` → same
- `scrapeAllPrices()` → merged array from all sources
- `buildCSVRows(dbIngredients, allPrices)` → CSV row objects
- `buildNewSuggestionRows()` → CSV rows for NEW ingredient suggestions
- `rowsToCSV(rows)` → CSV string (UTF-8 BOM for Excel)
- `normalizeForMatching(str)` → preprocessed string (exported for testing)
- `computeSimilarity(a, b)` → similarity score 0–1 (exported for testing)

### New Ingredient Suggestions
Rows with `db_id = "NEW"` for Jakarta-relevant items not in DB:
Petai, Jengkol, Kemangi, Daun Bawang, Bayam, Pakcoy, Pare, Kencur, Merica Bubuk,
Ikan Bandeng, Ikan Kembung, Ikan Asin, Daging Kambing, Susu Kental Manis,
Tepung Beras, Saus Tiram, Kaldu Bubuk, Daun Pisang, Kelapa Parut, Cuka

---

## Phase 3: API Endpoints

**File:** `server/routes/ingredients.js`

### `POST /api/ingredients/sync-prices` (requireAuth, requireAdmin)
Body: `{ threshold?: number }` (default 30%)

Logic:
1. Load all DB ingredients
2. Call `scrapeAllPrices()` in parallel across all 5 sources
3. Run `findBestMatch()` per ingredient — 3-tier lookup
4. Route by confidence + threshold:
   - `HIGH` (alias/canonical/Jaccard≥0.65) + `|Δ%| ≤ threshold` → `toUpdate[]`; if matched via Tier 3 Jaccard, also write `canonical_name` in the same transaction
   - `HIGH` + `|Δ%| > threshold` → `toFlagged[]` (price swing too large; user reviews)
   - `MEDIUM` (substring alias) + `|Δ%| ≤ threshold` → `toUpdate[]`
   - `MEDIUM` + `|Δ%| > threshold` → `toFlagged[]`
   - `MEDIUM_JACCARD` (Jaccard 0.45–0.64) → **always** `toNormalized[]` (name confirmation required before trusting price)
   - no match → `toSkipped[]`
5. Run all `toUpdate[]` writes in a single transaction (`price_per_unit`, `price_last_updated_at`, `canonical_name` if applicable)
6. Return `{ updated, auto_normalized, flagged[], normalized[], skipped, sources_used[], threshold_pct, total_ingredients }`

`auto_normalized` = count of Tier 3 HIGH matches that newly registered a `canonical_name` (shown as a summary pill in the UI).

### `POST /api/ingredients/set-prices` (requireAuth, requireAdmin)
Body: `{ items: [{ id, price }] }`
- Force-applies the flagged list (user-reviewed large price swings)
- Transaction-wrapped; returns `{ applied }`

### `POST /api/ingredients/apply-normalizations` (requireAuth, requireAdmin)
Body: `{ items: [{ id, canonical_name, price }] }`

```sql
UPDATE ingredients
  SET canonical_name        = $1,
      price_per_unit        = $2,
      price_last_updated_at = NOW()
WHERE id = $3
```

Transaction-wrapped; returns `{ applied }`. User-dismissed items are excluded from the request body — no server-side dismiss concept needed.

---

## Phase 4: CLI Scripts (CSV workflow — kept for power users / ops)

**File:** `server/scripts/scrape-ingredient-prices.js`
- CLI wrapper: connects to DB, calls shared module, writes `output/ingredient-prices-YYYY-MM-DD.csv`
- `match_confidence` column now has 3 values: `HIGH`, `MEDIUM`, `MEDIUM_JACCARD`
- `MEDIUM_JACCARD` rows include `notes = "Nama mirip via Jaccard — konfirmasi diperlukan"`
- BOM-prefixed CSV for Excel compatibility

**File:** `server/scripts/import-ingredient-prices.js`
- Reads reviewed CSV, applies `approve_update = YES` rows (UPDATE or INSERT)
- For `MEDIUM_JACCARD` rows approved via CSV: also writes `canonical_name` from `scraped_raw_name` column
- Transaction-wrapped; prints updated / inserted / skipped / warnings

```bash
# On-demand scrape → CSV review
node server/scripts/scrape-ingredient-prices.js
# outputs: output/ingredient-prices-2026-03-14.csv

# Review CSV, set approve_update = YES/NO, then import:
node server/scripts/import-ingredient-prices.js output/ingredient-prices-2026-03-14.csv
```

---

## Phase 5: UI — Sync Button, Result Dialog & Ingredient Card

**File:** `src/pages/Ingredients.tsx`

### TypeScript Interfaces

```ts
interface NormalizationItem {
  id: number;
  current_name: string;        // user's display name (unchanged in DB)
  suggested_canonical: string; // matched market name
  similarity: number;          // 0.0–1.0
  scraped_price: number;
  current_price: number;
  source: string;
}

interface FlaggedItem {
  id: number;
  name: string;
  unit: string;
  old_price: number;
  new_price: number;
  change_pct: string;
  source: string;
}

interface SyncResult {
  updated: number;
  auto_normalized: number;       // Tier 3 HIGH matches auto-registered
  flagged: FlaggedItem[];
  normalized: NormalizationItem[];
  skipped: number;
  sources_used: string[];
  threshold_pct: number;
  total_ingredients: number;
}
```

### State Additions
```ts
const [isSyncingPrices, setIsSyncingPrices] = useState(false);
const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
const [isSyncResultOpen, setIsSyncResultOpen] = useState(false);
const [dismissedNormIds, setDismissedNormIds] = useState<Set<number>>(new Set());
```

### Sync Button (header, admin-only)
- Rendered left of "Tambah Bahan"; outline style (less prominent than primary action)
- `RefreshCw` icon at rest; spinner + "Memperbarui..." while in-flight
- Disabled while `isSyncingPrices`

### Result Dialog — 3 Sections

**Section 1 — Summary row (always visible):**
```
[ ✅ 32 Diperbarui ] [ ⚠ 4 Harga Berubah ] [ 🔍 3 Nama Baru ]
```
Color: emerald (updated), amber (flagged), indigo (normalized).
Optional small pill below: `✨ 5 nama dikenali otomatis` — shown only if `auto_normalized > 0`.

**Section 2 — Flagged prices (amber):**
Per-row: ingredient name | old price (strikethrough) → new price (bold amber) | ±% | source.
"Terapkan yang Ditandai" CTA → calls `POST /set-prices`.
Collapsible if > 5 items.

**Section 3 — Nama Belum Dikenali (indigo):**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 3 Nama Belum Dikenali                                     │
│ Konfirmasi agar sinkronisasi berikutnya otomatis.            │
│ Nama tampilan tidak berubah.                                 │
│                                                              │
│ "cabe merah"  →  cabai merah keriting   ●●● 71%   [✕]       │
│                   Rp0 → Rp45.000 · hargapangan.id            │
│                                                              │
│ "daun bwg"   →  daun bawang hijau        ●● 58%   [✕]        │
│                   Rp0 → Rp6.000 · Sayurbox                   │
│                                                              │
│              [ Konfirmasi Semua (3) ]  [ Lewati Semua ]      │
└──────────────────────────────────────────────────────────────┘
```

Design details:
- "Nama tampilan tidak berubah" — reassures user their custom name is preserved
- Similarity dots: `●●●` ≥65%, `●●` ≥55%, `●` ≥45%
- `[✕]` per-item dismiss → adds `id` to `dismissedNormIds` Set → row hides immediately (optimistic UI, no API call)
- "Konfirmasi Semua" → filter out dismissed → `POST /apply-normalizations`
- "Lewati Semua" → close section, no API call
- Dismissed items: local state only; reappear on next sync if still unmatched

```ts
const applyNormalizations = async (items: NormalizationItem[]) => {
  const toApply = items.filter(i => !dismissedNormIds.has(i.id));
  if (!toApply.length) return;
  await api.post('/ingredients/apply-normalizations', {
    items: toApply.map(i => ({
      id: i.id,
      canonical_name: i.suggested_canonical,
      price: i.scraped_price,
    })),
  });
  toast.success(`${toApply.length} nama dikonfirmasi!`);
  setIsSyncResultOpen(false);
  fetchIngredients(true);
};
```

**File:** `src/components/IngredientCard.tsx`

Interface additions:
```ts
price_last_updated_at: string | null;
canonical_name: string | null;
```

Price section additions (below the existing price line):
1. **Freshness indicator** — when `price_last_updated_at` is set:
   - `↻ hari ini` (green `text-[9px]`) — updated ≤7 days ago
   - `↻ Xd lalu` (muted grey `text-[9px]`) — updated >7 days ago
2. **Unrecognized warning** — when `price_per_unit === 0` AND `canonical_name === null`:
   ```tsx
   <p className="text-[9px] font-medium text-amber-400 mt-0.5">⚠ Harga belum tersedia</p>
   ```
   Subtle, non-alarming. Disappears automatically once a sync confirms the name or sets the price.
3. Nothing shown when `price_per_unit === 0` but `canonical_name` is set (sync pending; no alarm needed).

---

## Modified Files Summary

| File | Change |
|---|---|
| `server/db.js` | Add `price_last_updated_at TIMESTAMP` + `canonical_name VARCHAR(150)` migrations |
| `server/package.json` | Add `cheerio ^1.0.0` (axios already present) |
| `server/lib/ingredient-price-scraper.js` | **NEW** — all 5 scrapers, `NAME_ALIASES`, `normalizeForMatching`, `computeSimilarity`, 3-tier `findBestMatch`, CSV helpers |
| `server/routes/ingredients.js` | Add `POST /sync-prices`, `POST /set-prices`, `POST /apply-normalizations` |
| `server/scripts/scrape-ingredient-prices.js` | **NEW** — CLI scraper |
| `server/scripts/import-ingredient-prices.js` | **NEW** — CLI CSV importer (supports `canonical_name` write) |
| `src/pages/Ingredients.tsx` | Sync button, `SyncResult` + `NormalizationItem` types, 3-section result dialog |
| `src/components/IngredientCard.tsx` | `canonical_name` field, freshness indicator, `⚠ Harga belum tersedia` badge |
| `.gitignore` | Add `output/` |

---

## Complete Sync User Journey

1. Admin opens **Inventory Bahan** page
2. Clicks **"Sync Harga"** → spinner shows "Memperbarui..."
3. Server scrapes all 5 sources in parallel (~10–20s)
4. Modal shows: 32 diperbarui / 4 harga berubah / 3 nama baru / ✨ 5 nama auto-dikenali
5. **Flagged prices** — admin reviews large swings; clicks "Terapkan yang Ditandai" to apply, or Tutup to skip
6. **Nama Belum Dikenali** — admin confirms or dismisses each suggestion; "Konfirmasi Semua" writes `canonical_name` + price to DB
7. Each ingredient card shows `↻ hari ini` (green) after sync

**Next sync (same ingredient "cabe merah" now has `canonical_name = "cabai merah keriting"`):**
- Tier 2 fast-path hits → O(1) alias lookup → no Jaccard ever needed again

---

## Complete New-Ingredient Journey (MEDIUM_JACCARD)

1. Admin adds "tomat ceri" (cherry tomato, price 0)
2. Sync: `computeSimilarity("tomat ceri", "tomat merah")`:
   - Jaccard = 1/3 = 0.33; Overlap = 1/2 = 0.50 → score = 0.50 → `MEDIUM_JACCARD`
3. Dialog shows "🔍 1 Nama Belum Dikenali": `"tomat ceri" → tomat merah ● 50%`
4. Admin correctly **dismisses** — cherry tomato ≠ regular tomato
5. "tomat ceri" stays unrecognized; card shows `⚠ Harga belum tersedia`
6. Admin sets price manually, or adds a proper alias to `NAME_ALIASES`

---

## CLI Workflow (power users / ops)

```bash
# On-demand scrape → CSV review
node server/scripts/scrape-ingredient-prices.js
# outputs: output/ingredient-prices-2026-03-14.csv

# Review CSV, set approve_update = YES/NO, then import:
node server/scripts/import-ingredient-prices.js output/ingredient-prices-2026-03-14.csv
```

---

## Verification Steps

1. **Similarity math:**
   ```bash
   node -e "const s=require('./server/lib/ingredient-price-scraper'); console.log(s.computeSimilarity('cabe merah','cabai merah keriting'), s.computeSimilarity('bawang merah','bawang bombay'), s.computeSimilarity('wortel','wortel segar'))"
   # Expected: ~1.0, 0.50, 1.0
   ```
2. Add "kangkong" ingredient → sync → verify `normalized[]` contains "kangkung" at HIGH confidence (~0.86)
3. Confirm normalization in dialog → check DB: `canonical_name = 'kangkung'`, price updated
4. Sync again → verify Tier 2 fast-path hits (no Jaccard re-computation)
5. Add "tomat ceri" → sync → verify MEDIUM_JACCARD (0.50) in `normalized[]`, NOT auto-applied
6. Dismiss → card shows `⚠ Harga belum tersedia`
7. Check IngredientCard: ingredient updated today → shows `↻ hari ini` (green)
8. Run CLI: `node server/scripts/scrape-ingredient-prices.js` → verify `MEDIUM_JACCARD` rows appear in CSV with notes

---

## Further Considerations

1. **Live source accessibility** — infopangan.jakarta.go.id and marketplace APIs may return 403/CAPTCHA depending on IP. Curated fallback ensures full coverage regardless.
2. **Marketplace pricing** — Tokopedia/Sayurbox/Superindo reflect retail/delivery prices, not traditional market (pasar) prices. Merge priority keeps government sources first; marketplace data only fills gaps.
3. **Volatile items (cabai, bawang)** — Price swings >30% are common. The threshold flag + review step prevents silent large updates. Consider lowering threshold to 20% for production.
4. **Packaged goods** — Kecap, santan instan, minyak kemasan vary by brand; curated data uses mid-range estimate with min/max noted in the `notes` column of the CSV.
5. **Single-token ingredients** (wortel, kentang, kangkung) — rely on preprocessing stripping noise from scraped names. If over-stripping occurs, add directly to `NAME_ALIASES`.
6. **Threshold tuning** — 0.45 MEDIUM_JACCARD threshold excludes `bawang merah ↔ bawang bombay` (0.50) from auto-apply while surfacing it for review. Raise to 0.55 if false positives appear in production.
7. **`canonical_name` is internal only** — user's display name is never changed. The field is invisible in the UI.
8. **New ingredients in future** — No code change needed. Any new ingredient is caught by Tier 3 Jaccard on the next button press. HIGH ≥0.65 → auto-registered. MEDIUM_JACCARD → user confirms. The system is self-extending.
9. **New ingredients (db_id = "NEW")** — CLI import script uses `ON CONFLICT (name) DO UPDATE` so re-running is safe. Review `db_unit` carefully for new rows before approving.
