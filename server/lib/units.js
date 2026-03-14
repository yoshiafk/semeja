/**
 * Indonesian Cooking Unit Conversions
 * Converts common units to base metric units (kg, liter, pieces)
 */

const WEIGHT_MAP = {
  // Bawang-bawangan & spices
  'siung': 0.005, // 1 clove approx 5g
  'buah': {
    'default': 0.05,
    'bawang bombay': 0.15,
    'bawang merah': 0.01,
    'bawang putih': 0.005,
    'tomat': 0.06,
    'cabai': 0.005,
    'cabe': 0.005,
    'kentang': 0.15,
    'wortel': 0.10,
    'telur': 0.06,
    'kemiri': 0.004,
    'ikan': 0.15,
  },
  'butir': {
    'default': 0.01,
    'telur': 0.06,
    'kemiri': 0.005,
    'bawang': 0.005,
  },
  'ruas': 0.01, // jahe, kunyit
  'jempol': 0.015,
  'ikat': 0.25, // kangkung, bayam
  'bungkus': 0.1,
  'sachet': 0.05,
  'batang': 0.02, // serai, daun bawang
  'lembar': 0.001, // daun salam, daun jeruk
  
  // Weights
  'kg': 1,
  'kilogram': 1,
  'gr': 0.001,
  'gram': 0.001,
  'g': 0.001,
  'ons': 0.1,
  
  // Volumes
  'liter': 1,
  'l': 1,
  'ml': 0.001,
  'cc': 0.001,
  'gelas': 0.25,
  'cup': 0.25,
  'sdm': 0.015, // sendok makan
  'sdt': 0.005, // sendok teh
};

/**
 * Normalizes a quantity to a base unit weight/volume
 * @param {number} qty The raw quantity
 * @param {string} unit The unit string (e.g. "siung")
 * @param {string} name The ingredient name (for context-aware pieces)
 * @returns {number} The quantity in base units (kg or liter)
 */
function convertToWeight(qty, unit, name = '') {
  if (!qty || !unit) return qty;
  
  const u = unit.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  
  // Exact match
  if (WEIGHT_MAP[u] !== undefined) {
    if (typeof WEIGHT_MAP[u] === 'number') {
      return qty * WEIGHT_MAP[u];
    }
    
    // Context-sensitive pieces (buah, butir)
    if (typeof WEIGHT_MAP[u] === 'object') {
      for (const [key, value] of Object.entries(WEIGHT_MAP[u])) {
        if (key !== 'default' && n.includes(key)) {
          return qty * value;
        }
      }
      return qty * (WEIGHT_MAP[u].default || 1);
    }
  }
  
  // Fuzzy match for common plural/variations
  if (u.includes('siung')) return qty * WEIGHT_MAP['siung'];
  if (u.includes('ruas')) return qty * WEIGHT_MAP['ruas'];
  if (u === 'bh' || u.includes('buah') || u.includes('biji') || u.includes('ekor')) return convertToWeight(qty, 'buah', name);
  if (u.includes('butir')) return convertToWeight(qty, 'butir', name);
  if (u.includes('sdm')) return qty * WEIGHT_MAP['sdm'];
  if (u.includes('sdt')) return qty * WEIGHT_MAP['sdt'];
  if (u.includes('ml')) return qty * 0.001;
  if (u.includes('gram') || u === 'gr' || u === 'g') return qty * 0.001;
  
  return qty; // fallback: return as is if unknown
}

module.exports = {
  convertToWeight,
  WEIGHT_MAP
};
