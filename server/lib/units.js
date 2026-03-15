/**
 * Indonesian Cooking Unit Conversions
 * Converts common units to base metric units (kg or liter)
 *
 * IMPROVEMENT #4: Expanded unit map with context-aware weights for
 * common Indonesian kitchen ingredients. Each entry is either:
 *   - number  → flat multiplier (qty × multiplier = kg or liter)
 *   - object  → context-aware map keyed by ingredient keyword
 *               Falls back to 'default' when no keyword matches.
 */

const WEIGHT_MAP = {
  // ── Whole pieces / counts ─────────────────────────────────────
  'siung': {
    default: 0.005,       // generic clove ~5g
    'bawang putih': 0.004, // garlic clove ~4g
    'bawang merah': 0.008, // shallot segment ~8g
  },

  'buah': {
    default: 0.05,
    'bawang bombay': 0.15,
    'bawang merah': 0.008,
    'bawang putih': 0.004,
    'tomat': 0.08,
    'tomat ceri': 0.02,
    'cabai merah': 0.015,
    'cabai': 0.008,
    'cabe': 0.008,
    'cabai rawit': 0.004,
    'cabe rawit': 0.004,
    'kentang': 0.15,
    'ubi': 0.20,
    'singkong': 0.30,
    'wortel': 0.10,
    'jagung': 0.20,
    'telur': 0.06,
    'kemiri': 0.004,
    'ikan': 0.15,
    'jeruk nipis': 0.06,
    'jeruk lemon': 0.10,
    'pepaya': 0.80,
    'pisang': 0.12,
    'mangga': 0.25,
    'apel': 0.18,
    'alpukat': 0.25,
    'terong': 0.20,
    'pare': 0.15,
    'labu': 0.50,
    'nanas': 0.80,
    'kelapa': 0.40,
  },

  'butir': {
    default: 0.01,
    'telur': 0.06,
    'telur ayam': 0.06,
    'telur bebek': 0.075,
    'kemiri': 0.005,
    'bawang': 0.008,
    'merica': 0.001,
    'lada': 0.001,
    'cengkeh': 0.001,
  },

  'biji': {
    default: 0.005,
    'kemiri': 0.005,
    'merica': 0.001,
    'lada': 0.001,
    'cengkeh': 0.001,
    'kapulaga': 0.003,
    'ketumbar': 0.002,
    'cabai kering': 0.003,
  },

  'ekor': {
    default: 0.15,         // generic fish/shrimp ~150g
    'udang': 0.015,        // per shrimp ~15g
    'udang besar': 0.03,
    'ayam': 1.00,          // whole chicken
    'ikan': 0.30,
    'ikan kecil': 0.05,
    'ikan besar': 0.50,
    'belut': 0.05,
    'lele': 0.20,
    'gurame': 0.40,
    'nila': 0.25,
  },

  'potong': {
    default: 0.10,
    'ayam': 0.12,          // chicken piece ~120g
    'daging': 0.08,
    'iga': 0.15,
    'ikan': 0.10,
    'tahu': 0.04,
    'tempe': 0.04,
  },

  'keping': {
    default: 0.02,
    'tempe': 0.025,
    'tahu': 0.03,
  },

  'iris': {
    default: 0.015,
    'bawang': 0.008,
    'jahe': 0.010,
    'kunyit': 0.008,
  },

  // ── Roots & aromatics ─────────────────────────────────────────
  'ruas': {
    default: 0.01,         // generic knob ~10g
    'jahe': 0.015,
    'kunyit': 0.008,
    'lengkuas': 0.015,
    'kencur': 0.010,
    'temu kunci': 0.008,
  },

  'jempol': {
    default: 0.015,
    'jahe': 0.015,
    'kunyit': 0.010,
  },

  'cm': {
    default: 0.005,        // per centimetre of root
    'jahe': 0.006,
    'kunyit': 0.004,
    'lengkuas': 0.010,
    'kayu manis': 0.005,
  },

  // ── Leaves & fresh herbs ──────────────────────────────────────
  'lembar': {
    default: 0.001,
    'daun salam': 0.001,
    'daun jeruk': 0.0005,
    'daun pandan': 0.003,
    'daun kunyit': 0.002,
    'daun pisang': 0.020,
    'daun kol': 0.030,
    'kubis': 0.030,
    'kol': 0.030,
    'sawi': 0.020,
  },

  'helai': {
    default: 0.001,
    'daun salam': 0.001,
    'daun jeruk': 0.0005,
    'daun pandan': 0.003,
  },

  // ── Stalks & bunches ──────────────────────────────────────────
  'batang': {
    default: 0.020,
    'serai': 0.015,        // lemongrass stalk ~15g
    'serai wangi': 0.015,
    'daun bawang': 0.015,  // spring onion ~15g
    'daun seledri': 0.010,
    'seledri': 0.010,
    'kayu manis': 0.008,
    'cinnamon': 0.008,
  },

  'tangkai': {
    default: 0.010,
    'cabai': 0.008,
    'tomat ceri': 0.050,
    'seledri': 0.010,
  },

  'ikat': {
    default: 0.25,         // bunch of leafy greens
    'kangkung': 0.20,
    'bayam': 0.20,
    'kemangi': 0.05,
    'daun bawang': 0.10,
    'seledri': 0.08,
    'sawi': 0.25,
    'kacang panjang': 0.20,
  },

  'genggam': {
    default: 0.030,
    'kemangi': 0.020,
    'daun kemangi': 0.020,
    'bayam': 0.040,
    'kangkung': 0.040,
  },

  // ── Packaged goods ────────────────────────────────────────────
  'bungkus': {
    default: 0.100,
    'mie': 0.085,          // instant noodle packet
    'mie instan': 0.085,
    'santan': 0.065,       // small santan sachet
    'bumbu': 0.030,
    'tahu': 0.100,
    'tempe': 0.200,
    'kerupuk': 0.050,
  },

  'sachet': {
    default: 0.050,
    'santan': 0.065,
    'bumbu': 0.030,
    'kecap': 0.020,
  },

  'kaleng': {
    default: 0.400,
    'santan': 0.400,
    'sarden': 0.155,
    'kornet': 0.200,
    'jagung': 0.400,
  },

  'botol': {
    default: 0.300,
    'kecap': 0.300,
    'saus': 0.300,
    'minyak': 0.500,
  },

  // ── Volume measures ───────────────────────────────────────────
  'liter': 1,
  'l': 1,
  'ml': 0.001,
  'cc': 0.001,
  'gelas': 0.25,           // standard drinking glass ~250ml
  'cup': 0.25,
  'mangkuk': 0.30,         // small bowl ~300ml
  'sdm': 0.015,            // sendok makan (tablespoon) ~15ml
  'sendok makan': 0.015,
  'sdt': 0.005,            // sendok teh (teaspoon) ~5ml
  'sendok teh': 0.005,
  'sp': 0.005,             // abbreviation for sendok teh
  'sm': 0.015,             // abbreviation for sendok makan

  // ── Weight measures ───────────────────────────────────────────
  'kg': 1,
  'kilogram': 1,
  'gr': 0.001,
  'gram': 0.001,
  'g': 0.001,
  'ons': 0.1,              // Indonesian ons = 100g
  'hg': 0.1,              // hectogram = 100g

  // ── Pinch / dash ──────────────────────────────────────────────
  'sejumput': 0.002,       // pinch ~2g
  'secubit': 0.001,        // smaller pinch ~1g
  'jumput': 0.002,

  // ── Piece aliases ─────────────────────────────────────────────
  'pcs': 0.05,
  'bh': 0.05,              // abbreviation for buah
};

/**
 * Resolves a context-sensitive weight map entry.
 * Iterates over the map keys (excluding 'default') and checks if the
 * ingredient name contains that keyword. Falls back to 'default'.
 *
 * @param {object} map - e.g. { 'telur': 0.06, default: 0.01 }
 * @param {string} name - lowercase ingredient name
 * @returns {number}
 */
function resolveContextMap(map, name) {
  for (const [keyword, value] of Object.entries(map)) {
    if (keyword !== 'default' && name.includes(keyword)) {
      return value;
    }
  }
  return map.default || 1;
}

/**
 * Converts a quantity in a given unit to its base weight (kg) or volume (liter).
 *
 * @param {number} qty   - raw quantity value
 * @param {string} unit  - unit string (e.g. 'siung', 'sdm', 'gram')
 * @param {string} name  - ingredient name for context-aware lookups
 * @returns {number}     - quantity in kg or liter
 */
function convertToWeight(qty, unit, name = '') {
  if (!qty || !unit) return qty || 0;

  const u = unit.toLowerCase().trim();
  const n = name.toLowerCase().trim();

  // 1. Direct / exact match
  const entry = WEIGHT_MAP[u];
  if (entry !== undefined) {
    if (typeof entry === 'number') return qty * entry;
    if (typeof entry === 'object') return qty * resolveContextMap(entry, n);
  }

  // 2. Fuzzy / variant matching for common typos and shortforms
  if (u.includes('siung'))                  return qty * resolveContextMap(WEIGHT_MAP['siung'], n);
  if (u.includes('ruas'))                   return qty * resolveContextMap(WEIGHT_MAP['ruas'], n);
  if (u === 'bh' || u.includes('buah') || u.includes('biji') || u.includes('bj'))
                                            return qty * resolveContextMap(WEIGHT_MAP['buah'], n);
  if (u.includes('butir'))                  return qty * resolveContextMap(WEIGHT_MAP['butir'], n);
  if (u.includes('ekor'))                   return qty * resolveContextMap(WEIGHT_MAP['ekor'], n);
  if (u.includes('potong') || u === 'ptg') return qty * resolveContextMap(WEIGHT_MAP['potong'], n);
  if (u.includes('lembar') || u.includes('helai') || u === 'lbr')
                                            return qty * resolveContextMap(WEIGHT_MAP['lembar'], n);
  if (u.includes('batang') || u === 'btg') return qty * resolveContextMap(WEIGHT_MAP['batang'], n);
  if (u.includes('ikat'))                   return qty * resolveContextMap(WEIGHT_MAP['ikat'], n);
  if (u.includes('sdm') || u === 'tbsp')   return qty * WEIGHT_MAP['sdm'];
  if (u.includes('sdt') || u === 'tsp')    return qty * WEIGHT_MAP['sdt'];
  if (u.includes('gram') || u === 'gr' || u === 'g')
                                            return qty * 0.001;
  if (u.includes('ml') || u === 'mililiter') return qty * 0.001;
  if (u.includes('liter') || u === 'lt')   return qty * 1;
  if (u.includes('kg') || u.includes('kilo')) return qty * 1;

  // 3. Secukupnya / unknown — cannot price, return 0 so it doesn't inflate estimates
  if (u === 'secukupnya' || u === 'qs' || u === 'q.s.' || u === '') return 0;

  // 4. Last resort: return qty as-is (treated as kg/liter)
  return qty;
}

/**
 * Returns a human-readable display label for a unit.
 * Used in shopping list and cost breakdown UI.
 *
 * @param {string} unit
 * @returns {string}
 */
function displayUnit(unit) {
  const aliases = {
    sdm: 'sdm', sdt: 'sdt', sm: 'sdm', sp: 'sdt',
    gr: 'g', gram: 'g',
    kilogram: 'kg',
    liter: 'L', ml: 'mL', cc: 'mL',
    bh: 'buah', biji: 'buah',
    btg: 'batang', lbr: 'lembar', ptg: 'potong',
  };
  return aliases[unit?.toLowerCase()] || unit || '';
}

module.exports = { convertToWeight, displayUnit, WEIGHT_MAP };
