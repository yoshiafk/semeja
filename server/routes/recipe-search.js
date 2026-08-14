const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const API_BASE_URL = 'https://food-recipe-api.vercel.app/api';

// GET search recipes from external API
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query (q) is required' });

    // Use azharimm/food-recipe-api which provides serving sizes and specific Indonesian dishes
    const response = await axios.get(`${API_BASE_URL}/search`, { params: { q } });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch external recipes', details: err.message });
  }
});

// GET specific recipe details from external API
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${API_BASE_URL}/recipe/${encodeURIComponent(id)}`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recipe details', details: err.message });
  }
});

// Helper function to extract numeric serving size from text (e.g., "Porsi: 4 Porsi" -> 4)
const extractServingSize = (servingsText) => {
  if (!servingsText) return 1;
  const match = servingsText.match(/(\d+)/);
  return match ? parseInt(match[1]) : 1;
};

// Map typical Indonesian units to standardized units
const unitMapping = {
  'g': 'gram',
  'gr': 'gram',
  'gram': 'gram',
  'kg': 'kg',
  'kilo': 'kg',
  'kilo gram': 'kg',
  'ml': 'ml',
  'mili': 'ml',
  'mililiter': 'ml',
  'liter': 'liter',
  'l': 'liter',
  'sdm': 'sdm',
  'sendok makan': 'sdm',
  'sdt': 'sdt',
  'sendok teh': 'sdt',
  'siung': 'siung',
  'biji': 'pcs',
  'buah': 'pcs',
  'butir': 'pcs',
  'lembar': 'lembar',
  'batang': 'batang',
  'ikat': 'ikat',
  'bungkus': 'bungkus',
  'sachet': 'bungkus',
  'secukupnya': 'secukupnya'
};

// Helper function to parse an ingredient string
// e.g., "250 gram daging sapi potong dadu" -> { quantity: 250, unit: 'gram', name: 'daging sapi potong dadu' }
const parseIngredient = (ingredientString) => {
  // Regex designed to catch common Indonesian formats: [Number/Fraction] [Unit] [Name]
  // Match groups:
  // 1: Quantity (e.g., "1", "1.5", "1/2")
  // 2: Fraction part (e.g., "/2")
  // 3: Unit (e.g., "gram", "sdm", "siung") - optional
  // 4: Name (the rest of the string)
  const regex = /^(\d+(?:[\.,]\d+)?(?:\/\d+)?(?:-\d+)?)\s*([a-zA-Z]+)?\s+(.*)$/i;
  
  const match = ingredientString.trim().match(regex);
  
  if (match) {
    let rawQty = match[1].replace(',', '.');
    let quantityStr = 0;
    
    // Handle fractions like 1/2
    if (rawQty.includes('/')) {
      const parts = rawQty.split('/');
      quantityStr = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else if (rawQty.includes('-')) {
        // Handle ranges like 1-2, take average
        const parts = rawQty.split('-');
        quantityStr = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
    } else {
      quantityStr = parseFloat(rawQty);
    }

    const rawUnit = match[2] ? match[2].toLowerCase() : '';
    const name = match[3].trim();
    
    // If unit is missing but the name starts with something like "ekor ayam", handle it
    let unit = 'secukupnya';
    if (rawUnit && unitMapping[rawUnit]) {
      unit = unitMapping[rawUnit];
    } else if (rawUnit) {
      // If a word was caught as a unit but isn't recognized, append it to the name
      return { 
        quantity: quantityStr || 1, 
        unit: 'pcs', 
        name: `${rawUnit} ${name}` 
      };
    }
    
    return { quantity: quantityStr || 1, unit, name };
  }
  
  // Fallback if parsing fails (e.g., "secukupnya garam", "bumbu halus:")
  return { quantity: 1, unit: 'secukupnya', name: ingredientString.trim() };
};

// POST import external recipe to local database
router.post('/import', requireAuth, requireAdmin, async (req, res) => {
  const { externalId } = req.body;
  if (!externalId) return res.status(400).json({ error: 'externalId is required' });

  const client = await pool.connect();
  try {
    // 1. Fetch full recipe from API
    const response = await axios.get(`${API_BASE_URL}/recipe/${encodeURIComponent(externalId)}`);
    const recipeData = response.data.results;

    if (!recipeData) {
      return res.status(404).json({ error: 'Recipe not found in API' });
    }

    await client.query('BEGIN');

    // 2. Extract servings 
    const servings = extractServingSize(recipeData.servings);

    // 3. Create Local Recipe
    const { rows: recipeRows } = await client.query(
      `INSERT INTO recipes (name, instructions) VALUES ($1, $2) RETURNING id`,
      [recipeData.title, JSON.stringify(recipeData.steps)]
    );
    const localRecipeId = recipeRows[0].id;

    // 4. Parse ingredients & insert
    // The API returns an array of ingredients strings
    for (const ingString of recipeData.ingredient) {
      const parsed = parseIngredient(ingString);
      
      // Calculate amount per person based on the API serving size
      const amountPerPerson = parsed.unit === 'secukupnya' ? null : (parsed.quantity / servings);
      
      // Attempt to link to an existing ingredient in the DB (fuzzy/ilike match)
      // This is highly simplified and will likely need user intervention later 
      // via the UI to map correctly to specific DB inventory ingredients if names mismatch.
      let dbIngredientId = null;
      
      // Extract main keyword from name (e.g., "ayam potong dadu" -> "ayam")
      const firstWord = parsed.name.split(' ')[0];
      
      // Avoid searching for generic words like "bawang", "daun" without context
      const skipGenericWords = ['bawang', 'daun', 'minyak', 'garam', 'gula', 'air'];
      
      if (firstWord && firstWord.length > 2 && !skipGenericWords.includes(firstWord.toLowerCase())) {
         const searchRes = await client.query(
            "SELECT id FROM ingredients WHERE name ILIKE $1 LIMIT 1",
            [`%${firstWord}%`]
         );
         if (searchRes.rows.length > 0) {
            dbIngredientId = searchRes.rows[0].id;
         }
      }

      await client.query(
        `INSERT INTO recipe_ingredients 
         (recipe_id, name, quantity_per_person, custom_unit, is_optional, ingredient_id) 
         VALUES ($1, $2, $3, $4, false, $5)`,
        [localRecipeId, parsed.name, amountPerPerson, parsed.unit, dbIngredientId]
      );
    }

    await client.query('COMMIT');
    
    // Return the newly created local recipe ID so frontend can redirect/refresh
    res.json({ success: true, local_recipe_id: localRecipeId, parsed_servings: servings });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to import recipe', details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
