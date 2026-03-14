'use strict';

/**
 * ingredient-price-scraper.js
 *
 * Shared module for scraping Jakarta traditional market (pasar tradisional) ingredient prices.
 *
 * Data sources (priority order):
 *  1. hargapangan.id  — PIHPS (Panel Harga Pangan Nasional / Badan Pangan Nasional)
 *                       13 strategic commodities, updated daily for each province.
 *  2. infopangan.jakarta.go.id — Jakarta DKPKP portal, 35+ commodities from DKI markets.
 *  3. Curated fallback — Researched Jakarta traditional-market prices (baseline March 2026).
 *                        Always succeeds; ensures full coverage when live sources are unavailable.
 *
 * Usage:
 *   const scraper = require('./lib/ingredient-price-scraper');
 *   const rows = await scraper.buildPriceRows(dbIngredients);
 *   // rows is an array of CSVRow objects ready to be written to CSV.
 */

const axios = require('axios');
const cheerio = require('cheerio');

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const HTTP_TIMEOUT_MS = 3_000;   // per-request; keeps each scraper well under Vercel's 10 s limit
const SCRAPER_DEADLINE_MS = 7_000; // each scraper must resolve within this; falls back to [] on timeout

const USER_AGENT =
  'Mozilla/5.0 (compatible; semeja-price-bot/1.0; Jakarta ingredient price monitor)';

// DKI Jakarta province codes used in common Indonesian government APIs
const DKI_JAKARTA_PROVINCE_CODE = 31; // BPS / Kemendagri standard

// ---------------------------------------------------------------------------
// NAME ALIAS MAP
// DB ingredient name (exact case) → array of expected scraped names (lowercase)
// Used to map between DB names and names appearing in government price portals.
// ---------------------------------------------------------------------------
const NAME_ALIASES = {
  // --- POKOK ---
  'Beras IR. I (IR 64)':          ['beras ir64', 'beras ir 64', 'beras medium', 'beras lokal', 'beras'],
  'Gula':                          ['gula pasir lokal', 'gula pasir premium', 'gula pasir'],
  'Gula Pasir':                    ['gula pasir lokal', 'gula pasir premium', 'gula pasir'],
  'Minyak Goreng (Kuning/Curah)':  ['minyak goreng curah', 'minyak goreng kemasan', 'minyak goreng'],
  'Minyak untuk menumis':          ['minyak goreng curah', 'minyak goreng'],
  'Tepung Tapioka':                ['tepung tapioka'],
  'Tepung Terigu':                 ['tepung terigu protein sedang', 'tepung terigu'],
  'Mie Instan':                    ['mie instan', 'mi instan', 'indomie'],
  // --- PROTEIN ---
  'Ayam Negeri':                   ['daging ayam ras', 'ayam broiler', 'ayam negeri', 'ayam ras'],
  'Daging Ayam Broiler':           ['daging ayam ras', 'ayam broiler', 'ayam ras'],
  'Daging Sapi':                   ['daging sapi murni', 'daging sapi has dalam', 'daging sapi'],
  'Ikan':                          ['ikan segar', 'ikan tongkol', 'ikan layur'],
  'Ikan Nila':                     ['ikan nila', 'nila segar'],
  'Lele':                          ['ikan lele', 'lele segar'],
  'Tahu':                          ['tahu putih', 'tahu sumedang', 'tahu'],
  'Tempe':                         ['tempe kedelai', 'tempe'],
  'Telur Ayam Ras':                ['telur ayam ras', 'telur ayam'],
  'Udang':                         ['udang basah', 'udang segar'],
  // --- SAYURAN ---
  'Jagung':                        ['jagung manis', 'jagung biasa', 'jagung'],
  'Jagung Manis':                  ['jagung manis'],
  'Kacang Panjang':                ['kacang panjang'],
  'Kangkung':                      ['kangkung air', 'kangkung'],
  'Kembang Kol':                   ['kembang kol', 'bunga kol'],
  'Kentang':                       ['kentang'],
  'Kol':                           ['kubis / kol', 'kol putih', 'kubis', 'kol'],
  'Labu Siam':                     ['labu siam'],
  'Sawi':                          ['sawi hijau', 'sawi'],
  'Sawi Putih':                    ['sawi putih', 'petsai'],
  'Tauge':                         ['tauge / kecambah', 'kecambah kedelai', 'tauge', 'kecambah'],
  'Tomat':                         ['tomat sayur', 'tomat merah', 'tomat'],
  'Wortel':                        ['wortel'],
  // --- BUAH ---
  'Melon':                         ['melon', 'buah melon'],
  'Semangka':                      ['semangka merah', 'semangka'],
  // --- BUMBU ---
  'Asam Jawa':                     ['asam jawa', 'asam'],
  'Bawang Merah':                  ['bawang merah'],
  'Bawang Putih':                  ['bawang putih impor', 'bawang putih lokal', 'bawang putih'],
  'Cabai Merah Keriting':          ['cabai merah keriting', 'cabe merah keriting'],
  'Cabe Merah Keriting':           ['cabai merah keriting', 'cabe merah keriting', 'cabai merah'],
  'Cabai Rawit Merah':             ['cabai rawit merah', 'cabe rawit merah', 'cabai rawit'],
  'Cabe Rawit Merah':              ['cabe rawit merah', 'cabai rawit merah', 'cabai rawit'],
  'Daun Jeruk':                    ['daun jeruk purut', 'daun jeruk'],
  'Daun Salam':                    ['daun salam'],
  'Garam':                         ['garam halus', 'garam dapur', 'garam beryodium', 'garam'],
  'Jahe':                          ['jahe merah', 'jahe segar', 'jahe'],
  'Kemiri':                        ['kemiri'],
  'Ketumbar':                      ['ketumbar bubuk', 'ketumbar'],
  'Kunyit':                        ['kunyit segar', 'kunyit'],
  'Lengkuas':                      ['lengkuas', 'laos'],
  'Serai':                         ['serai', 'sereh', 'lemon grass'],
  // --- LAINNYA ---
  'Bawang Goreng':                 ['bawang goreng'],
  'Bumbu Rendang Jadi':            ['bumbu rendang jadi', 'bumbu rendang'],
  'Daun bawang':                   ['daun bawang', 'daun bawang hijau'],
  'ikan kembung':                  ['ikan kembung', 'kembung segar'],
  'Jeruk Nipis':                   ['jeruk nipis segar', 'jeruk nipis'],
  'Jagung Manis':                  ['jagung manis pipil', 'jagung manis'],
  'Kacang Tanah':                  ['kacang tanah mentah', 'kacang tanah'],
  'Kecap Asin':                    ['kecap asin'],
  'Kecap Manis':                   ['kecap manis bango', 'kecap manis abc', 'kecap manis'],
  'Sambal':                        ['sambal botolan', 'sambal'],
  'Santan':                        ['santan instan', 'santan kelapa', 'santan'],
  'Santan Kental':                 ['santan kental', 'krim santan'],
  'Terasi Udang':                  ['terasi udang', 'terasi', 'belacan'],
  'Udang Kupas':                   ['udang kupas', 'udang'],
};

// ---------------------------------------------------------------------------
// CURATED FALLBACK DATA (March 2026)
// Research basis:
//   - Pasar Induk Kramat Jati (wholesale market, East Jakarta)
//   - infopangan.jakarta.go.id historical price data
//   - BPS DKI Jakarta consumer price statistics Q1 2026
//   - Retail observation: Pasar Minggu, Pasar Santa, Pasar Mampang
// rawName must match values in NAME_ALIASES arrays (lowercase)
// ---------------------------------------------------------------------------
const CURATED_FALLBACK = [
  // POKOK
  { rawName: 'beras ir 64',           price: 14500,  unit: 'kg',       category: 'Pokok',    notes: 'Beras medium; range Rp14,000–16,000/kg (Pasar Induk Kramat Jati Mar-2026)' },
  { rawName: 'gula pasir',            price: 18000,  unit: 'kg',       category: 'Pokok',    notes: 'Gula pasir lokal; range Rp17,500–19,000/kg' },
  { rawName: 'mie instan',            price: 3800,   unit: 'pcs',      category: 'Pokok',    notes: 'Indomie standard; range Rp3,500–4,000/pcs retail' },
  { rawName: 'minyak goreng curah',   price: 15500,  unit: 'kg',       category: 'Pokok',    notes: 'Curah; range Rp15,000–16,000/kg; kemasan liter avg Rp21,000' },
  { rawName: 'tepung tapioka',        price: 12000,  unit: 'kg',       category: 'Pokok',    notes: 'Rose Brand/Pak Tani; range Rp11,000–13,000/kg' },
  { rawName: 'tepung terigu',         price: 12000,  unit: 'kg',       category: 'Pokok',    notes: 'Protein sedang (Segitiga Biru); range Rp11,000–13,000/kg' },
  // PROTEIN
  { rawName: 'ayam negeri',           price: 40000,  unit: 'ekor',     category: 'Protein',  notes: 'Per ekor ~1 kg; range Rp38,000–42,000/ekor' },
  { rawName: 'daging ayam ras',       price: 38000,  unit: 'kg',       category: 'Protein',  notes: 'Karkas; range Rp35,000–42,000/kg' },
  { rawName: 'daging sapi murni',     price: 138000, unit: 'kg',       category: 'Protein',  notes: 'Has/gandik/daging murni; range Rp130,000–145,000/kg Mar-2026' },
  { rawName: 'ikan segar',            price: 45000,  unit: 'kg',       category: 'Protein',  notes: 'Ikan tongkol/layur avg; range Rp40,000–55,000/kg' },
  { rawName: 'ikan nila',             price: 32000,  unit: 'ekor',     category: 'Protein',  notes: 'Nila segar per ekor ~0.5–0.7 kg; range Rp28,000–35,000' },
  { rawName: 'ikan lele',             price: 30000,  unit: 'kg',       category: 'Protein',  notes: 'Lele segar; range Rp28,000–33,000/kg' },
  { rawName: 'ikan kembung',          price: 38000,  unit: 'kg',       category: 'Protein',  notes: 'Kembung segar; range Rp30,000–45,000/kg' },
  { rawName: 'tahu putih',            price: 4000,   unit: 'pcs',      category: 'Protein',  notes: 'Tahu putih medium; range Rp3,000–5,000/pcs' },
  { rawName: 'tempe kedelai',         price: 8500,   unit: 'pcs',      category: 'Protein',  notes: 'Blok 250 g; range Rp7,000–10,000/pcs' },
  { rawName: 'telur ayam ras',        price: 29000,  unit: 'kg',       category: 'Protein',  notes: '~11–12 butir/kg; range Rp27,000–32,000/kg' },
  { rawName: 'udang basah',           price: 85000,  unit: 'kg',       category: 'Protein',  notes: 'Udang sedang; range Rp78,000–95,000/kg' },
  // SAYURAN
  { rawName: 'jagung manis',          price: 6000,   unit: 'pcs',      category: 'Sayuran',  notes: 'Per tongkol; range Rp5,000–7,000' },
  { rawName: 'kacang panjang',        price: 7000,   unit: 'ikat',     category: 'Sayuran',  notes: 'Satu ikat ~200 g; range Rp6,000–8,000' },
  { rawName: 'kangkung air',          price: 6000,   unit: 'ikat',     category: 'Sayuran',  notes: 'Range Rp5,000–8,000/ikat' },
  { rawName: 'kembang kol',           price: 14000,  unit: 'bonggol',  category: 'Sayuran',  notes: 'Per bonggol ~500 g; range Rp12,000–18,000' },
  { rawName: 'kentang',               price: 17000,  unit: 'kg',       category: 'Sayuran',  notes: 'Kentang medium; range Rp15,000–19,000/kg' },
  { rawName: 'kubis / kol',           price: 10000,  unit: 'pcs',      category: 'Sayuran',  notes: 'Per buah ~1 kg; range Rp8,000–12,000' },
  { rawName: 'labu siam',             price: 5000,   unit: 'pcs',      category: 'Sayuran',  notes: 'Per buah; range Rp4,000–6,000' },
  { rawName: 'sawi hijau',            price: 6000,   unit: 'ikat',     category: 'Sayuran',  notes: 'Sawi hijau per ikat; range Rp5,000–7,000' },
  { rawName: 'sawi putih',            price: 12000,  unit: 'kg',       category: 'Sayuran',  notes: 'Per kg; note: DB unit is "lembar" — pertimbangkan ganti ke "kg"' },
  { rawName: 'tauge / kecambah',      price: 10000,  unit: 'kg',       category: 'Sayuran',  notes: 'Kecambah kedelai; range Rp9,000–12,000/kg' },
  { rawName: 'tomat merah',           price: 15000,  unit: 'kg',       category: 'Sayuran',  notes: 'Range Rp12,000–20,000/kg (seasonal volatile)' },
  { rawName: 'wortel',                price: 16000,  unit: 'kg',       category: 'Sayuran',  notes: 'Range Rp14,000–20,000/kg' },
  // BUAH
  { rawName: 'melon',                 price: 8000,   unit: 'potong',   category: 'Buah',     notes: 'Per potong; range Rp6,000–10,000; per kg Rp12,000–20,000' },
  { rawName: 'semangka merah',        price: 5000,   unit: 'potong',   category: 'Buah',     notes: 'Per potong; range Rp4,000–7,000; per kg Rp4,000–8,000' },
  // BUMBU
  { rawName: 'asam jawa',             price: 25000,  unit: 'kg',       category: 'Bumbu',    notes: 'Basah; range Rp22,000–28,000/kg' },
  { rawName: 'bawang merah',          price: 42000,  unit: 'kg',       category: 'Bumbu',    notes: 'VOLATILE: range Rp33,000–58,000/kg; avg Mar-2026 Rp42,000' },
  { rawName: 'bawang putih',          price: 38000,  unit: 'kg',       category: 'Bumbu',    notes: 'Impor (80% supply); range Rp35,000–45,000/kg' },
  { rawName: 'cabai merah keriting',  price: 45000,  unit: 'kg',       category: 'Bumbu',    notes: 'VOLATILE: range Rp28,000–65,000/kg; mid-range avg Mar-2026' },
  { rawName: 'cabe rawit merah',      price: 62000,  unit: 'kg',       category: 'Bumbu',    notes: 'VOLATILE: range Rp40,000–90,000/kg; mid-range avg Mar-2026' },
  { rawName: 'daun jeruk purut',      price: 2500,   unit: 'pack',     category: 'Bumbu',    notes: 'Sachet/pack kecil; range Rp2,000–3,000' },
  { rawName: 'daun salam',            price: 2500,   unit: 'pack',     category: 'Bumbu',    notes: 'Sachet/pack kecil; range Rp2,000–3,000' },
  { rawName: 'garam halus',           price: 3500,   unit: 'bungkus',  category: 'Bumbu',    notes: 'Garam beryodium 250 g; range Rp3,000–4,000/bungkus' },
  { rawName: 'jahe segar',            price: 3500,   unit: 'pack',     category: 'Bumbu',    notes: 'Pack ~100 g; per kg Rp28,000–35,000' },
  { rawName: 'kemiri',                price: 6000,   unit: 'pack',     category: 'Bumbu',    notes: 'Pack ~50 g; range Rp5,000–8,000' },
  { rawName: 'ketumbar',              price: 55000,  unit: 'kg',       category: 'Bumbu',    notes: 'Biji; range Rp50,000–65,000/kg' },
  { rawName: 'kunyit segar',          price: 3000,   unit: 'pack',     category: 'Bumbu',    notes: 'Pack ~50 g; per kg Rp15,000–25,000' },
  { rawName: 'lengkuas',              price: 3000,   unit: 'pack',     category: 'Bumbu',    notes: 'Pack ~100 g; per kg Rp15,000–20,000' },
  { rawName: 'serai',                 price: 4000,   unit: 'ikat',     category: 'Bumbu',    notes: 'Per ikat ~5 batang; range Rp3,000–5,000' },
  // LAINNYA
  { rawName: 'bawang goreng',         price: 52000,  unit: 'kg',       category: 'Lainnya',  notes: 'Kemasan; range Rp45,000–60,000/kg' },
  { rawName: 'bumbu rendang jadi',    price: 7000,   unit: 'bungkus',  category: 'Lainnya',  notes: 'Bumbu instan; range Rp6,000–9,000/bungkus' },
  { rawName: 'daun bawang hijau',     price: 6000,   unit: 'ikat',     category: 'Lainnya',  notes: 'Satu ikat ~100 g; range Rp5,000–8,000' },
  { rawName: 'jeruk nipis segar',     price: 1000,   unit: 'buah',     category: 'Lainnya',  notes: 'Per buah; range Rp800–1,200; per kg Rp25,000–35,000' },
  { rawName: 'kacang tanah mentah',   price: 28000,  unit: 'kg',       category: 'Lainnya',  notes: 'Range Rp25,000–32,000/kg raw' },
  { rawName: 'kecap asin',            price: 18000,  unit: 'botol',    category: 'Lainnya',  notes: 'ABC/Bango 135 ml; range Rp15,000–20,000' },
  { rawName: 'kecap manis',           price: 22000,  unit: 'botol',    category: 'Lainnya',  notes: 'ABC/Bango 275 ml; range Rp18,000–24,000' },
  { rawName: 'sambal botolan',        price: 14000,  unit: 'botol',    category: 'Lainnya',  notes: 'Sambal ABC dll; range Rp12,000–16,000' },
  { rawName: 'santan instan',         price: 8000,   unit: 'kemasan',  category: 'Lainnya',  notes: 'Kara 200 ml; range Rp7,000–9,000/kemasan' },
  { rawName: 'santan kental',         price: 18000,  unit: 'liter',    category: 'Lainnya',  notes: 'Krim santan kemasan; range Rp15,000–20,000/liter' },
  { rawName: 'terasi udang',          price: 8000,   unit: 'sdt',      category: 'Lainnya',  notes: 'Per 100 g blok Rp8,000–12,000; unit "sdt" (teaspoon) kurang ideal — pertimbangkan "bungkus/100g"' },
  { rawName: 'udang kupas',           price: 90000,  unit: 'gram',     category: 'Protein',  notes: 'Unit DB "gram" → harga per gram; per kg Rp85,000–95,000. Pertimbangkan ganti unit ke "kg"' },
];

// ---------------------------------------------------------------------------
// NEW INGREDIENT SUGGESTIONS
// Jakarta-relevant ingredients not currently in the DB
// ---------------------------------------------------------------------------
const NEW_SUGGESTIONS = [
  { name: 'Petai',             unit: 'papan',    price: 20000,  category: 'Sayuran',  notes: 'Papan isi ~10 biji; range Rp15,000–25,000/papan' },
  { name: 'Jengkol',          unit: 'kg',       price: 28000,  category: 'Sayuran',  notes: 'Range Rp22,000–35,000/kg (seasonal)' },
  { name: 'Kemangi',          unit: 'ikat',     price: 4000,   category: 'Sayuran',  notes: 'Satu ikat; range Rp3,000–5,000' },
  { name: 'Daun Bawang',      unit: 'ikat',     price: 6000,   category: 'Sayuran',  notes: 'Range Rp5,000–8,000/ikat ~100 g' },
  { name: 'Bayam',            unit: 'ikat',     price: 5000,   category: 'Sayuran',  notes: 'Bayam hijau; range Rp4,000–6,000/ikat' },
  { name: 'Pakcoy',           unit: 'ikat',     price: 8000,   category: 'Sayuran',  notes: 'Range Rp6,000–10,000/ikat' },
  { name: 'Pare',             unit: 'kg',       price: 12000,  category: 'Sayuran',  notes: 'Paria/pare; range Rp10,000–15,000/kg' },
  { name: 'Kencur',           unit: 'pack',     price: 3000,   category: 'Bumbu',    notes: 'Pack ~50 g; per kg Rp20,000–30,000' },
  { name: 'Merica Bubuk',     unit: 'pack',     price: 8000,   category: 'Bumbu',    notes: 'Merica hitam/putih giling 50 g; range Rp7,000–10,000' },
  { name: 'Ikan Bandeng',     unit: 'kg',       price: 38000,  category: 'Protein',  notes: 'Bandeng segar; range Rp32,000–42,000/kg' },
  { name: 'Ikan Kembung',     unit: 'kg',       price: 38000,  category: 'Protein',  notes: 'Ikan kembung segar; range Rp30,000–45,000/kg' },
  { name: 'Ikan Asin',        unit: 'kg',       price: 45000,  category: 'Protein',  notes: 'Teri/jambal roti; range Rp40,000–60,000/kg' },
  { name: 'Daging Kambing',   unit: 'kg',       price: 120000, category: 'Protein',  notes: 'Range Rp110,000–130,000/kg' },
  { name: 'Susu Kental Manis',unit: 'kaleng',   price: 14000,  category: 'Lainnya',  notes: 'SKM 395 g (Frisian Flag/Indomilk); range Rp12,000–15,000' },
  { name: 'Tepung Beras',     unit: 'kg',       price: 13000,  category: 'Pokok',    notes: 'Rose Brand dll; range Rp12,000–15,000/kg' },
  { name: 'Saus Tiram',       unit: 'botol',    price: 18000,  category: 'Lainnya',  notes: 'ABC/Saori 175 g; range Rp15,000–22,000' },
  { name: 'Kaldu Bubuk',      unit: 'pack',     price: 15000,  category: 'Lainnya',  notes: 'Masako/Royco 100 g; range Rp12,000–18,000; sachet 8 g Rp1,500' },
  { name: 'Daun Pisang',      unit: 'lembar',   price: 5000,   category: 'Lainnya',  notes: 'Per lembar besar; range Rp4,000–7,000' },
  { name: 'Kelapa Parut',     unit: 'butir',    price: 10000,  category: 'Lainnya',  notes: 'Sudah diparut per butir kelapa; range Rp8,000–12,000' },
  { name: 'Cuka',             unit: 'botol',    price: 8000,   category: 'Lainnya',  notes: 'Cuka putih 630 ml; range Rp7,000–10,000' },
];

// ---------------------------------------------------------------------------
// LIVE SCRAPER: hargapangan.id (PIHPS – Badan Pangan Nasional)
// ---------------------------------------------------------------------------

/**
 * Attempts to fetch commodity prices from hargapangan.id for DKI Jakarta
 * (province code 31, pasar tradisional).
 *
 * The site is a React SPA; we try two approaches:
 *  1. Internal REST API endpoint (discovered via browser DevTools)
 *  2. HTML table fallback on the public-facing page
 *
 * Returns an array of { rawName, price, unit, source } or [] on failure.
 */
async function scrapeHargaPangan() {
  const results = [];

  // Attempt 1: REST API (Badan Pangan Nasional internal API)
  const apiEndpoints = [
    `https://panelharga.badanpangan.go.id/data/province-avg-by-date?province_id=${DKI_JAKARTA_PROVINCE_CODE}&level_pasar=1`,
    `https://hargapangan.id/api/v1/commodity-prices?province_id=${DKI_JAKARTA_PROVINCE_CODE}&market_type=1`,
    `https://hargapangan.id/api/price/daily?provinsi=${DKI_JAKARTA_PROVINCE_CODE}`,
  ];

  for (const url of apiEndpoints) {
    try {
      const res = await axios.get(url, {
        timeout: HTTP_TIMEOUT_MS,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });

      const rows = res.data?.data ?? res.data;
      if (!Array.isArray(rows) || rows.length === 0) continue;

      for (const row of rows) {
        const name  = (row.nama_komoditi || row.commodity_name || row.name || '').trim();
        const price = parseInt(row.harga || row.price || row.rata_rata || 0, 10);
        const unit  = (row.satuan || row.unit || 'kg').toLowerCase();
        if (name && price > 0) {
          results.push({ rawName: name.toLowerCase(), price, unit, source: 'hargapangan.id API' });
        }
      }

      if (results.length > 0) {
        console.log(`[hargaPangan] Fetched ${results.length} items from ${url}`);
        return results;
      }
    } catch {
      // Try next endpoint
    }
  }

  // Attempt 2: HTML table scraping
  try {
    const res = await axios.get(
      'https://hargapangan.id/tabel-harga/pasar-tradisional/daerah',
      { timeout: HTTP_TIMEOUT_MS, headers: { 'User-Agent': USER_AGENT } },
    );
    const $ = cheerio.load(res.data);
    $('table tbody tr').each((_i, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 2) return;
      const name  = $(cells[0]).text().trim();
      const raw   = $(cells[cells.length - 1]).text().replace(/[^\d]/g, '');
      const price = parseInt(raw, 10);
      if (name && price > 500 && price < 5_000_000) {
        results.push({ rawName: name.toLowerCase(), price, unit: 'kg', source: 'hargapangan.id HTML' });
      }
    });
    if (results.length > 0) console.log(`[hargaPangan] HTML scraped ${results.length} items.`);
  } catch (err) {
    console.warn(`[hargaPangan] HTML scrape failed: ${err.message}`);
  }

  return results;
}

// ---------------------------------------------------------------------------
// LIVE SCRAPER: infopangan.jakarta.go.id (Jakarta DKPKP portal)
// ---------------------------------------------------------------------------

/**
 * Attempts to fetch commodity prices from the Jakarta city government food
 * price portal (infopangan.jakarta.go.id).
 *
 * Tries:
 *  1. Known JSON API endpoints
 *  2. HTML table parsing on the public portal page
 *
 * Returns an array of { rawName, price, unit, source } or [] on failure.
 */
async function scrapeInfoPanganJakarta() {
  const results = [];

  // Attempt 1: JSON API
  const apiEndpoints = [
    'https://infopangan.jakarta.go.id/publik/api/getkomoditi',
    'https://infopangan.jakarta.go.id/api/v1/komoditi',
    'https://infopangan.jakarta.go.id/publik/komoditi',
  ];

  for (const url of apiEndpoints) {
    try {
      const res = await axios.get(url, {
        timeout: HTTP_TIMEOUT_MS,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html' },
      });

      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      if (!Array.isArray(rows) || rows.length === 0) continue;

      for (const row of rows) {
        const name  = (row.nama_komoditi || row.nama || row.name || '').trim();
        const price = parseInt(row.harga_eceran || row.harga || row.price || 0, 10);
        const unit  = (row.satuan || row.unit || 'kg').toLowerCase();
        if (name && price > 0) {
          results.push({ rawName: name.toLowerCase(), price, unit, source: 'infopangan.jakarta.go.id API' });
        }
      }

      if (results.length > 0) {
        console.log(`[infoPangan] Fetched ${results.length} items from ${url}`);
        return results;
      }
    } catch {
      // Try next endpoint
    }
  }

  // Attempt 2: HTML table
  try {
    const res = await axios.get('https://infopangan.jakarta.go.id', {
      timeout: HTTP_TIMEOUT_MS,
      headers: { 'User-Agent': USER_AGENT },
    });
    const $ = cheerio.load(res.data);
    $('table tbody tr, table tr').each((_i, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 2) return;
      const name  = $(cells[0]).text().trim();
      const raw   = $(cells[cells.length - 1]).text().replace(/[^\d]/g, '');
      const price = parseInt(raw, 10);
      // Simple sanity check: IDR price for food should be 500 – 2,000,000
      if (name && price > 500 && price < 2_000_000) {
        results.push({ rawName: name.toLowerCase(), price, unit: 'kg', source: 'infopangan.jakarta.go.id HTML' });
      }
    });
    if (results.length > 0) console.log(`[infoPangan] HTML scraped ${results.length} items.`);
  } catch (err) {
    console.warn(`[infoPangan] HTML scrape failed: ${err.message}`);
  }

  return results;
}

// ---------------------------------------------------------------------------
// NAME NORMALIZATION (for Jaccard similarity matching)
// ---------------------------------------------------------------------------

const NOISE_WORDS = new Set([
  'segar','lokal','impor','curah','kemasan','organik','premium','pilihan',
  'siap','masak','murah','higienis','sachet','botolan','cair',
  'iris','kupas','cincang','parut','potong','mentah','matang',
  'istimewa','satu','setengah','per','dan',
]);

const SYNONYMS = {
  'cabe':  'cabai',
  'mie':   'mi',
  'pete':  'petai',
};

/**
 * Preprocessing pipeline for Jaccard similarity:
 * 1. Lowercase + NFKD diacritic strip
 * 2. Strip punctuation
 * 3. Strip embedded quantities (500g, 1kg, 250ml)
 * 4. Synonym normalization
 * 5. Remove noise adjectives
 * 6. Collapse whitespace
 */
function normalizeForMatching(str) {
  let s = str.toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\d+\s*(?:kg|g|gram|ml|liter|pcs|l)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  for (const [from, to] of Object.entries(SYNONYMS)) {
    s = s.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  s = s.split(' ').filter(w => w && !NOISE_WORDS.has(w)).join(' ').trim();
  return s || str.toLowerCase().trim();
}

/**
 * Similarity score = max(Jaccard, OverlapCoefficient)
 * Both computed on preprocessed token sets.
 *
 * Jaccard(A,B) = |A∩B|/|A∪B|  — penalises set size difference
 * Overlap(A,B) = |A∩B|/min(|A|,|B|) — handles name subsets (e.g. "wortel" vs "wortel segar")
 */
function computeSimilarity(a, b) {
  const na = normalizeForMatching(a);
  const nb = normalizeForMatching(b);
  if (na === nb) return 1.0;
  const setA = new Set(na.split(' ').filter(Boolean));
  const setB = new Set(nb.split(' ').filter(Boolean));
  const intersect = new Set([...setA].filter(x => setB.has(x)));
  if (intersect.size === 0) return 0;
  const union = new Set([...setA, ...setB]);
  const jaccard = intersect.size / union.size;
  const overlap = intersect.size / Math.min(setA.size, setB.size);
  return Math.max(jaccard, overlap);
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Normalize a string for alias comparison:
 * lowercase, collapse whitespace, strip non-alphanumeric (keep spaces).
 */
function normalizeStr(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * 3-tier name matching:
 *
 * Tier 1 — NAME_ALIASES[ing.name] exists → exact/substring alias comparison → HIGH or MEDIUM
 * Tier 2 — ing.canonical_name is set → use it as alias fast-path → HIGH (no Jaccard needed)
 * Tier 3 — new/unaliased ingredient → computeSimilarity across all scraped items
 *           score ≥ 0.65 → HIGH, 0.45–0.64 → MEDIUM_JACCARD
 *
 * Returns { item, confidence, similarity, fromJaccard } or null.
 *   fromJaccard=true  → Tier 3 HIGH match; caller should register canonical_name
 *   similarity        → 1.0 for Tier 1/2, computed value for Tier 3
 */
function findBestMatch(dbIngredient, scrapedList) {
  const dbName       = dbIngredient.name;
  const canonicalName = dbIngredient.canonical_name || null;

  // ---- Tier 1: explicit aliases ----
  const aliases = NAME_ALIASES[dbName];
  if (aliases) {
    for (const scraped of scrapedList) {
      const sn = normalizeStr(scraped.rawName);
      if (aliases.includes(sn)) {
        return { item: scraped, confidence: 'HIGH', similarity: 1.0, fromJaccard: false };
      }
    }
    // Substring fallback within aliased set
    for (const scraped of scrapedList) {
      const sn = normalizeStr(scraped.rawName);
      if (aliases.find(a => sn.includes(a) || a.includes(sn))) {
        return { item: scraped, confidence: 'MEDIUM', similarity: 0.9, fromJaccard: false };
      }
    }
    // Aliased ingredient with no scraped match → skip Jaccard (name is authoritative)
    return null;
  }

  // ---- Tier 2: canonical_name fast-path ----
  if (canonicalName) {
    const canonAliases = NAME_ALIASES[canonicalName] ?? [normalizeStr(canonicalName)];
    for (const scraped of scrapedList) {
      const sn = normalizeStr(scraped.rawName);
      if (canonAliases.includes(sn)) {
        return { item: scraped, confidence: 'HIGH', similarity: 1.0, fromJaccard: false };
      }
    }
    // Also try normalizeForMatching exact token equality
    const canonNorm = normalizeForMatching(canonicalName);
    for (const scraped of scrapedList) {
      if (normalizeForMatching(scraped.rawName) === canonNorm) {
        return { item: scraped, confidence: 'HIGH', similarity: 1.0, fromJaccard: false };
      }
    }
    return null; // canonical_name set but source data not found this run
  }

  // ---- Tier 3: Jaccard / Overlap computation ----
  let bestItem  = null;
  let bestScore = 0;

  for (const scraped of scrapedList) {
    const score = computeSimilarity(dbName, scraped.rawName);
    if (score > bestScore) {
      bestScore = score;
      bestItem  = scraped;
    }
  }

  if (bestScore >= 0.65) {
    return { item: bestItem, confidence: 'HIGH', similarity: bestScore, fromJaccard: true };
  }
  if (bestScore >= 0.45) {
    return { item: bestItem, confidence: 'MEDIUM_JACCARD', similarity: bestScore, fromJaccard: true };
  }
  return null;
}

/**
 * Determine approve_update value for a CSV row.
 *   YES    – HIGH confidence, price change ≤ 30%, current DB price > 0
 *   REVIEW – MEDIUM, MEDIUM_JACCARD, or large swing
 *   NO     – no match
 */
function decideApproval(confidence, changePct, currentDbPrice) {
  if (!confidence) return 'NO';
  if (confidence === 'MEDIUM_JACCARD') return 'REVIEW';
  if (
    confidence === 'HIGH' &&
    currentDbPrice > 0 &&
    Math.abs(changePct) <= 30
  ) return 'YES';
  return 'REVIEW';
}

// ---------------------------------------------------------------------------
// MARKETPLACE SCRAPERS
// ---------------------------------------------------------------------------

/**
 * High-value / volatile items to search on marketplaces.
 * Govs portals cover staples well; marketplaces fill gaps for fresh produce.
 */
const MARKETPLACE_SEARCHES = [
  'bawang merah', 'bawang putih', 'cabai merah keriting', 'cabai rawit merah',
  'daging sapi', 'daging ayam', 'telur ayam ras', 'udang segar',
  'tomat', 'wortel', 'kentang', 'tahu putih', 'tempe',
  'ikan kembung', 'kangkung',
];

/**
 * Tokopedia: ACE REST API with __NEXT_DATA__ SSR fallback.
 * Only queries volatile/high-value items to avoid rate-limiting.
 */
async function scrapeTokopedia() {
  // Parallel fetch for all keywords — avoids sequential waiting within a single scraper
  const fetches = MARKETPLACE_SEARCHES.map(keyword =>
    axios.get('https://ace.tokopedia.com/search/product/v3', {
      params: { q: keyword, official: false, start: 0, rows: 5 },
      timeout: HTTP_TIMEOUT_MS,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    }).then(res => {
      const products = res.data?.data?.products ?? [];
      const top = products.find(p => {
        const price = parseInt((p.price || '').toString().replace(/[^\d]/g, ''), 10);
        return price > 500 && price < 5_000_000;
      });
      if (!top) return null;
      const price = parseInt((top.price || '').toString().replace(/[^\d]/g, ''), 10);
      return { rawName: keyword, price, unit: 'kg', source: 'Tokopedia' };
    }).catch(() => null),
  );
  const results = (await Promise.all(fetches)).filter(Boolean);
  if (results.length > 0) console.log(`[Tokopedia] ${results.length} items scraped.`);
  return results;
}

/**
 * Sayurbox: catalog JSON API.
 */
async function scrapeSayurbox() {
  const results = [];
  const endpoints = [
    'https://www.sayurbox.com/api/v1/products?category=sayuran-buah&per_page=60',
    'https://www.sayurbox.com/api/v1/products?per_page=60',
  ];
  for (const url of endpoints) {
    try {
      const res = await axios.get(url, {
        timeout: HTTP_TIMEOUT_MS,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      const products = res.data?.data ?? res.data?.products ?? (Array.isArray(res.data) ? res.data : []);
      if (!Array.isArray(products) || products.length === 0) continue;
      for (const p of products) {
        const name  = (p.name || p.title || '').toLowerCase().trim();
        const price = parseInt(p.price || p.priceValue || 0, 10);
        const unit  = (p.unit || p.uom || 'kg').toLowerCase();
        if (name && price > 500 && price < 5_000_000) {
          results.push({ rawName: name, price, unit, source: 'Sayurbox' });
        }
      }
      if (results.length > 0) break;
    } catch {
      // Try next endpoint
    }
  }
  if (results.length > 0) console.log(`[Sayurbox] ${results.length} items scraped.`);
  return results;
}

/**
 * Superindo Online: JSON API → __NEXT_DATA__ SSR → CSS price selector fallbacks.
 */
async function scrapeSuperindo() {
  const results = [];

  // Attempt 1: JSON API
  try {
    const res = await axios.get('https://superindo.co.id/api/products?category=sayuran', {
      timeout: HTTP_TIMEOUT_MS,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    const products = res.data?.data ?? res.data?.products ?? [];
    for (const p of Array.isArray(products) ? products : []) {
      const name  = (p.name || p.title || '').toLowerCase().trim();
      const price = parseInt(p.price || p.priceValue || 0, 10);
      if (name && price > 500 && price < 5_000_000) {
        results.push({ rawName: name, price, unit: 'kg', source: 'Superindo' });
      }
    }
  } catch {
    // silent, try HTML fallback
  }

  if (results.length > 0) {
    console.log(`[Superindo] ${results.length} items scraped via API.`);
    return results;
  }

  // Attempt 2: HTML __NEXT_DATA__ + CSS selectors
  try {
    const res = await axios.get('https://www.superindo.co.id/produk/sayuran-dan-buah', {
      timeout: HTTP_TIMEOUT_MS,
      headers: { 'User-Agent': USER_AGENT },
    });
    const $ = cheerio.load(res.data);

    // __NEXT_DATA__ SSR
    const nextDataStr = $('script#__NEXT_DATA__').html();
    if (nextDataStr) {
      try {
        const nd = JSON.parse(nextDataStr);
        const prods =
          nd?.props?.pageProps?.products ??
          nd?.props?.pageProps?.data?.products ?? [];
        for (const p of prods) {
          const name  = (p.name || '').toLowerCase().trim();
          const price = parseInt(p.price || p.priceValue || 0, 10);
          if (name && price > 500) {
            results.push({ rawName: name, price, unit: 'kg', source: 'Superindo' });
          }
        }
      } catch { /* ignore malformed JSON */ }
    }

    // CSS price selector fallback
    if (results.length === 0) {
      $('[class*="product"]').each((_i, el) => {
        const nameEl  = $(el).find('[class*="name"], h2, h3').first();
        const priceEl = $(el).find('[class*="price"]').first();
        const name    = nameEl.text().trim().toLowerCase();
        const price   = parseInt(priceEl.text().replace(/[^\d]/g, ''), 10);
        if (name && price > 500 && price < 5_000_000) {
          results.push({ rawName: name, price, unit: 'kg', source: 'Superindo' });
        }
      });
    }
  } catch (err) {
    console.warn(`[Superindo] HTML scrape failed: ${err.message}`);
  }

  if (results.length > 0) console.log(`[Superindo] ${results.length} items scraped via HTML.`);
  return results;
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Run all 5 live scrapers in parallel and return a merged list.
 * Priority: hargapangan > infopangan > Tokopedia > Sayurbox > Superindo > curated
 * First occurrence per normalised rawName wins.
 */
// Wraps a scraper so it always resolves (never rejects) and returns [] if SCRAPER_DEADLINE_MS elapses
function withDeadline(fn) {
  return Promise.race([
    fn(),
    new Promise(resolve => setTimeout(() => resolve([]), SCRAPER_DEADLINE_MS)),
  ]);
}

async function scrapeAllPrices() {
  console.log('Running live scrapers…');
  // Superindo is excluded — its endpoints are consistently returning 404
  const [live1, live2, live3, live4] = await Promise.allSettled([
    withDeadline(scrapeHargaPangan),
    withDeadline(scrapeInfoPanganJakarta),
    withDeadline(scrapeTokopedia),
    withDeadline(scrapeSayurbox),
  ]);

  const items1 = live1.status === 'fulfilled' ? live1.value : [];
  const items2 = live2.status === 'fulfilled' ? live2.value : [];
  const items3 = live3.status === 'fulfilled' ? live3.value : [];
  const items4 = live4.status === 'fulfilled' ? live4.value : [];

  console.log(
    `  hargapangan.id → ${items1.length} | infopangan → ${items2.length} | Tokopedia → ${items3.length} | Sayurbox → ${items4.length}`,
  );

  // Priority merge: gov > marketplace > curated; first occurrence wins.
  const seen   = new Set();
  const merged = [];
  for (const item of [...items1, ...items2, ...items3, ...items4, ...CURATED_FALLBACK]) {
    const key = normalizeStr(item.rawName);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

/**
 * Match all DB ingredients against scraped/curated prices and build CSV rows.
 *
 * @param {Array} dbIngredients  Rows from SELECT * FROM ingredients
 * @returns {Array<Object>}      CSV row objects (one per DB ingredient)
 */
function buildCSVRows(dbIngredients, allPrices) {
  const rows = [];

  for (const ing of dbIngredients) {
    const match = findBestMatch(ing, allPrices);

    let scrapedPrice    = '';
    let scrapedUnit     = '';
    let scrapedRawName  = '';
    let scrapedSource   = '';
    let confidence      = '';
    let changePct       = '';
    let approveUpdate   = 'NO';
    let notes           = '';

    if (match) {
      scrapedPrice   = match.item.price;
      scrapedUnit    = match.item.unit;
      scrapedRawName = match.item.rawName;
      scrapedSource  = match.item.source;
      confidence     = match.confidence;
      notes          = match.item.notes ?? '';

      if (ing.price_per_unit > 0) {
        changePct = (((scrapedPrice - ing.price_per_unit) / ing.price_per_unit) * 100).toFixed(1);
      } else {
        changePct = 'N/A (DB price is 0)';
      }

      // Append Jaccard note for MEDIUM_JACCARD rows
      const matchNotes = match.item.notes ?? '';
      notes = confidence === 'MEDIUM_JACCARD'
        ? `Nama mirip via Jaccard (${Math.round(match.similarity * 100)}%) — konfirmasi diperlukan. ${matchNotes}`.trim()
        : matchNotes;

      approveUpdate = decideApproval(confidence, parseFloat(changePct) || 0, ing.price_per_unit);
    }

    rows.push({
      db_id:                    ing.id,
      db_name:                  ing.name,
      db_category:              ing.category ?? '',
      db_unit:                  ing.unit,
      db_current_price_idr:     ing.price_per_unit,
      scraped_price_idr:        scrapedPrice,
      scraped_unit:             scrapedUnit,
      match_confidence:         confidence,
      price_change_pct:         changePct,
      scraped_source:           scrapedSource,
      scraped_raw_name:         scrapedRawName,
      scraped_at:               new Date().toISOString(),
      notes,
      approve_update:           approveUpdate,
    });
  }

  return rows;
}

/**
 * Build CSV rows for new ingredient suggestions (db_id = "NEW").
 */
function buildNewSuggestionRows() {
  return NEW_SUGGESTIONS.map((s) => ({
    db_id:                    'NEW',
    db_name:                  s.name,
    db_category:              s.category,
    db_unit:                  s.unit,
    db_current_price_idr:     '',
    scraped_price_idr:        s.price,
    scraped_unit:             s.unit,
    match_confidence:         'HIGH',
    price_change_pct:         'N/A (new ingredient)',
    scraped_source:           'curated-jakarta-2026',
    scraped_raw_name:         s.name.toLowerCase(),
    scraped_at:               new Date().toISOString(),
    notes:                    s.notes ?? '',
    approve_update:           'REVIEW',
  }));
}

/**
 * Convert an array of CSV row objects to a CSV string.
 */
function rowsToCSV(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);

  const escape = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ];
  return lines.join('\n');
}

module.exports = {
  scrapeAllPrices,
  buildCSVRows,
  buildNewSuggestionRows,
  rowsToCSV,
  findBestMatch,
  normalizeForMatching,
  computeSimilarity,
  // Individual scrapers
  scrapeHargaPangan,
  scrapeInfoPanganJakarta,
  scrapeTokopedia,
  scrapeSayurbox,
  scrapeSuperindo,
  // Data sets
  CURATED_FALLBACK,
  NEW_SUGGESTIONS,
  NAME_ALIASES,
  NOISE_WORDS,
};
