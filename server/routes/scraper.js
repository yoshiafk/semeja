const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { pool } = require('../db');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract serving size from various text patterns
 * Handles: "4 porsi", "untuk 4 orang", "Porsi: 4", "4 servings", etc.
 */
function extractServings(text) {
  if (!text) return 1;
  
  const patterns = [
    /(\d+)\s*porsi/i,                    // "4 porsi"
    /porsi[:\s]*(\d+)/i,                 // "Porsi: 4" or "porsi 4"
    /untuk\s*(\d+)\s*orang/i,            // "untuk 4 orang"
    /(\d+)\s*orang/i,                    // "4 orang"
    /(\d+)\s*servings?/i,                // "4 servings"
    /serves?\s*(\d+)/i,                  // "serves 4"
    /(\d+)\s*pax/i,                      // "4 pax"
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const servings = parseInt(match[1]);
      if (servings > 0 && servings <= 100) { // reasonable range
        return servings;
      }
    }
  }
  
  return 1; // default to 1 if not found
}

/**
 * Parse ingredient text to extract quantity, unit, and name
 * Handles Indonesian patterns: "1/2 kg daging", "2 siung bawang", "secukupnya garam"
 */
function parseIngredientText(text) {
  let qty = 1;
  let unit = 'secukupnya';
  let name = text;
  
  // Handle "secukupnya" at the start
  if (text.toLowerCase().startsWith('secukupnya')) {
    return { qty: 0, unit: 'secukupnya', name: text.replace(/^secukupnya\s*/i, '').trim() || text };
  }
  
  // Handle fractions like "1/2", "1/4"
  const fractionMatch = text.match(/^(\d+)\/(\d+)\s*([a-zA-Z]+)?\s*(.*)$/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]) || 1;
    const denominator = parseFloat(fractionMatch[2]) || 1;
    qty = numerator / denominator;
    unit = fractionMatch[3] ? fractionMatch[3].toLowerCase() : 'secukupnya';
    name = fractionMatch[4] ? fractionMatch[4].trim() : text;
    return { qty, unit, name };
  }
  
  // Handle mixed fractions like "1 1/2 kg"
  const mixedMatch = text.match(/^(\d+)\s+(\d+)\/(\d+)\s*([a-zA-Z]+)?\s*(.*)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]) || 0;
    const numerator = parseFloat(mixedMatch[2]) || 0;
    const denominator = parseFloat(mixedMatch[3]) || 1;
    qty = whole + (numerator / denominator);
    unit = mixedMatch[4] ? mixedMatch[4].toLowerCase() : 'secukupnya';
    name = mixedMatch[5] ? mixedMatch[5].trim() : text;
    return { qty, unit, name };
  }
  
  // Handle decimal and whole numbers: "2.5 kg", "200 gram", "2 siung"
  const match = text.match(/^([\d.,]+)\s*([a-zA-Z]+)?\s*(.*)$/);
  if (match) {
    qty = parseFloat(match[1].replace(',', '.')) || 1;
    unit = match[2] ? match[2].toLowerCase() : 'secukupnya';
    name = match[3] ? match[3].trim() : text;
  }
  
  return { qty, unit, name: name || text };
}

/**
 * Scrape recipe data from Cookpad URL
 * Returns: { title, servings, ingredients: [{name, qty, unit}] }
 */
async function scrapeCookpad(url) {
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    timeout: 15000
  });

  const $ = cheerio.load(data);
  
  // Parse Title
  const title = $('h1').first().text().trim();
  if (!title) {
    throw new Error('Failed to parse recipe title. URL might be invalid or page structure changed.');
  }
  
  // Parse Servings - look in multiple places
  let servingsText = '';
  
  // Try common Cookpad selectors for serving info
  const servingSelectors = [
    '[itemprop="recipeYield"]',
    '.servings',
    '.yield',
    '.recipe-serving',
    '.serving-info',
    '.portion',
  ];
  
  for (const selector of servingSelectors) {
    const found = $(selector).first().text().trim();
    if (found) {
      servingsText = found;
      break;
    }
  }
  
  // Also search in recipe description/info area
  if (!servingsText) {
    $('.recipe-info, .recipe-meta, .recipe-details').each((_, el) => {
      const text = $(el).text();
      if (text.match(/porsi|orang|serving/i)) {
        servingsText = text;
        return false; // break
      }
    });
  }
  
  // Search in the full page text as fallback
  if (!servingsText) {
    const bodyText = $('body').text();
    const servingMatch = bodyText.match(/(?:untuk\s+)?(\d+)\s*(?:porsi|orang)/i);
    if (servingMatch) {
      servingsText = servingMatch[0];
    }
  }
  
  const servings = extractServings(servingsText);
  
  // Parse Ingredients
  const ingredients = [];
  $('.ingredient-list li, [itemprop="recipeIngredient"], .ingredient, .recipe-ingredient').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text && text.length > 1) {
      const parsed = parseIngredientText(text);
      ingredients.push(parsed);
    }
  });
  
  return { title, servings, ingredients };
}

/**
 * Find or create ingredient in database
 */
async function findOrCreateIngredient(client, name, unit) {
  // Try fuzzy match first (first 15 chars)
  const searchTerm = name.substring(0, 15).toLowerCase();
  const { rows: existing } = await client.query(
    'SELECT id, unit FROM ingredients WHERE LOWER(name) LIKE $1 LIMIT 1',
    [`%${searchTerm}%`]
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create new ingredient with price 0
  const { rows: newIng } = await client.query(
    "INSERT INTO ingredients (name, unit, price_per_unit, category) VALUES ($1, $2, 0, 'Lainnya') RETURNING id",
    [name, unit]
  );
  return newIng[0].id;
}

/**
 * Update meal_ingredients for all meals using a specific recipe
 */
async function propagateToMeals(client, recipeId) {
  // Find all meals that use this recipe
  const { rows: affectedMeals } = await client.query(
    `SELECT id, 
       CASE WHEN main_course_recipe_id = $1 THEN 'main' END as main_type,
       CASE WHEN second_course_recipe_id = $1 THEN 'second' END as second_type,
       CASE WHEN dessert_recipe_id = $1 THEN 'dessert' END as dessert_type
     FROM meals 
     WHERE main_course_recipe_id = $1 
        OR second_course_recipe_id = $1 
        OR dessert_recipe_id = $1`,
    [recipeId]
  );
  
  const updatedMealIds = [];
  
  for (const meal of affectedMeals) {
    const mealTypes = [meal.main_type, meal.second_type, meal.dessert_type].filter(Boolean);
    
    for (const mealType of mealTypes) {
      // Delete existing ingredients for this meal type
      await client.query(
        'DELETE FROM meal_ingredients WHERE meal_id = $1 AND meal_type = $2',
        [meal.id, mealType]
      );
      
      // Copy fresh from recipe_ingredients
      await client.query(
        `INSERT INTO meal_ingredients (meal_id, ingredient_id, quantity_per_person, meal_type)
         SELECT $1, ingredient_id, quantity_per_person, $2
         FROM recipe_ingredients WHERE recipe_id = $3`,
        [meal.id, mealType, recipeId]
      );
    }
    
    updatedMealIds.push(meal.id);
  }
  
  return updatedMealIds;
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /scraper/cookpad - Import new recipe from Cookpad
 * Body: { url: string, category: 'Lauk' | 'Sayur' | 'Dessert' }
 */
router.post('/cookpad', async (req, res) => {
  const { url, category } = req.body;
  if (!url || !url.includes('cookpad.com')) {
    return res.status(400).json({ error: 'Valid Cookpad URL is required' });
  }

  const client = await pool.connect();
  
  try {
    // Scrape the recipe
    const scraped = await scrapeCookpad(url);
    
    await client.query('BEGIN');

    // Create the Recipe with servings and normalized flag
    const { rows: recipeRows } = await client.query(
      `INSERT INTO recipes (name, description, category, source_url, servings, is_normalized) 
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [scraped.title, `Imported from Cookpad (${scraped.servings} porsi)`, category || 'Lauk', url, scraped.servings]
    );
    const recipe = recipeRows[0];
    
    const savedIngredients = [];

    // Process and normalize ingredients
    for (const ing of scraped.ingredients) {
      if (!ing.name) continue;
      
      const ingredient_id = await findOrCreateIngredient(client, ing.name, ing.unit);
      
      // NORMALIZE: divide quantity by servings to get per-person amount
      const normalizedQty = ing.qty > 0 ? (ing.qty / scraped.servings) : 0;

      await client.query(
        'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity_per_person, custom_unit, name) VALUES ($1, $2, $3, $4, $5)',
        [recipe.id, ingredient_id, normalizedQty, ing.unit, ing.name]
      );
      
      savedIngredients.push({ 
        ingredient_id, 
        quantity_per_person: normalizedQty, 
        original_quantity: ing.qty,
        custom_unit: ing.unit, 
        name: ing.name 
      });
    }

    await client.query('COMMIT');
    
    res.status(201).json({ 
      message: `Successfully imported recipe (normalized from ${scraped.servings} servings to 1 serving)`,
      recipe: { ...recipe, ingredients: savedIngredients }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /scraper/rescrape/:recipeId - Re-scrape existing recipe and normalize
 * Updates recipe_ingredients and propagates to linked meals
 */
router.put('/rescrape/:recipeId', async (req, res) => {
  const { recipeId } = req.params;
  
  const client = await pool.connect();
  
  try {
    // Get existing recipe
    const { rows: recipes } = await client.query(
      'SELECT * FROM recipes WHERE id = $1',
      [recipeId]
    );
    
    if (!recipes.length) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    const recipe = recipes[0];
    
    if (!recipe.source_url || !recipe.source_url.includes('cookpad.com')) {
      return res.status(400).json({ error: 'Recipe does not have a valid Cookpad source URL' });
    }
    
    // Scrape fresh data
    const scraped = await scrapeCookpad(recipe.source_url);
    
    await client.query('BEGIN');
    
    // Update recipe with new servings
    await client.query(
      `UPDATE recipes SET servings = $1, is_normalized = true, description = $2 WHERE id = $3`,
      [scraped.servings, `Imported from Cookpad (${scraped.servings} porsi)`, recipeId]
    );
    
    // Delete old ingredients
    await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipeId]);
    
    const savedIngredients = [];
    
    // Re-add normalized ingredients
    for (const ing of scraped.ingredients) {
      if (!ing.name) continue;
      
      const ingredient_id = await findOrCreateIngredient(client, ing.name, ing.unit);
      
      // NORMALIZE: divide by servings
      const normalizedQty = ing.qty > 0 ? (ing.qty / scraped.servings) : 0;

      await client.query(
        'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity_per_person, custom_unit, name) VALUES ($1, $2, $3, $4, $5)',
        [recipeId, ingredient_id, normalizedQty, ing.unit, ing.name]
      );
      
      savedIngredients.push({ 
        ingredient_id, 
        quantity_per_person: normalizedQty, 
        original_quantity: ing.qty,
        custom_unit: ing.unit, 
        name: ing.name 
      });
    }
    
    // Propagate changes to all meals using this recipe
    const updatedMealIds = await propagateToMeals(client, parseInt(recipeId));
    
    await client.query('COMMIT');
    
    res.json({ 
      message: `Re-scraped and normalized from ${scraped.servings} servings to 1 serving`,
      recipe: { ...recipe, servings: scraped.servings, is_normalized: true, ingredients: savedIngredients },
      updated_meals: updatedMealIds.length,
      meal_ids: updatedMealIds
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /scraper/rescrape-all - Re-scrape all un-normalized recipes with source URLs
 * Returns progress for each recipe
 */
router.post('/rescrape-all', async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Get all recipes with Cookpad URLs that are not normalized
    const { rows: recipes } = await pool.query(
      `SELECT id, name, source_url FROM recipes 
       WHERE source_url LIKE '%cookpad.com%' 
       AND (is_normalized = false OR is_normalized IS NULL)
       ORDER BY id`
    );
    
    if (recipes.length === 0) {
      return res.json({ 
        message: 'All recipes are already normalized',
        processed: 0,
        success: [],
        failed: []
      });
    }
    
    const results = {
      processed: 0,
      success: [],
      failed: []
    };
    
    for (const recipe of recipes) {
      try {
        // Scrape fresh data
        const scraped = await scrapeCookpad(recipe.source_url);
        
        await client.query('BEGIN');
        
        // Update recipe
        await client.query(
          `UPDATE recipes SET servings = $1, is_normalized = true, description = $2 WHERE id = $3`,
          [scraped.servings, `Imported from Cookpad (${scraped.servings} porsi)`, recipe.id]
        );
        
        // Delete old ingredients
        await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipe.id]);
        
        // Re-add normalized ingredients
        for (const ing of scraped.ingredients) {
          if (!ing.name) continue;
          
          const ingredient_id = await findOrCreateIngredient(client, ing.name, ing.unit);
          const normalizedQty = ing.qty > 0 ? (ing.qty / scraped.servings) : 0;

          await client.query(
            'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity_per_person, custom_unit, name) VALUES ($1, $2, $3, $4, $5)',
            [recipe.id, ingredient_id, normalizedQty, ing.unit, ing.name]
          );
        }
        
        // Propagate to meals
        const updatedMealIds = await propagateToMeals(client, recipe.id);
        
        await client.query('COMMIT');
        
        results.success.push({ 
          id: recipe.id, 
          name: recipe.name, 
          servings: scraped.servings,
          meals_updated: updatedMealIds.length
        });
        
      } catch (err) {
        await client.query('ROLLBACK');
        results.failed.push({ 
          id: recipe.id, 
          name: recipe.name, 
          error: err.message 
        });
      }
      
      results.processed++;
    }
    
    res.json({
      message: `Processed ${results.processed} recipes`,
      ...results
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /scraper/normalize/:recipeId - Manually normalize existing recipe
 * Body: { servings: number } - Divides all quantities by this number
 */
router.put('/normalize/:recipeId', async (req, res) => {
  const { recipeId } = req.params;
  const { servings } = req.body;
  
  if (!servings || servings < 1) {
    return res.status(400).json({ error: 'Valid servings number is required (minimum 1)' });
  }
  
  const client = await pool.connect();
  
  try {
    // Get existing recipe
    const { rows: recipes } = await client.query(
      'SELECT * FROM recipes WHERE id = $1',
      [recipeId]
    );
    
    if (!recipes.length) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    await client.query('BEGIN');
    
    // Update recipe servings
    await client.query(
      `UPDATE recipes SET servings = $1, is_normalized = true WHERE id = $2`,
      [servings, recipeId]
    );
    
    // Divide all ingredient quantities by servings
    await client.query(
      `UPDATE recipe_ingredients 
       SET quantity_per_person = quantity_per_person / $1 
       WHERE recipe_id = $2`,
      [servings, recipeId]
    );
    
    // Propagate to meals
    const updatedMealIds = await propagateToMeals(client, parseInt(recipeId));
    
    await client.query('COMMIT');
    
    // Get updated recipe with ingredients
    const { rows: updatedRecipe } = await client.query(
      'SELECT * FROM recipes WHERE id = $1',
      [recipeId]
    );
    const { rows: ingredients } = await client.query(
      `SELECT ri.*, i.name as ingredient_name, i.unit 
       FROM recipe_ingredients ri 
       JOIN ingredients i ON ri.ingredient_id = i.id 
       WHERE ri.recipe_id = $1`,
      [recipeId]
    );
    
    res.json({
      message: `Normalized recipe by dividing quantities by ${servings}`,
      recipe: { ...updatedRecipe[0], ingredients },
      updated_meals: updatedMealIds.length
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
