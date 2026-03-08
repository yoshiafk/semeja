const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { pool } = require('../db');

router.post('/cookpad', async (req, res) => {
  const { url, category } = req.body;
  if (!url || !url.includes('cookpad.com')) {
    return res.status(400).json({ error: 'Valid Cookpad URL is required' });
  }

  const client = await pool.connect();
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const $ = cheerio.load(data);
    
    // Parse Title
    const title = $('h1').first().text().trim();
    if (!title) {
        throw new Error('Failed to parse recipe title. URL might be invalid.');
    }
    
    // Parse Ingredients
    const scrapedIngredients = [];
    $('.ingredient-list li, [itemprop="recipeIngredient"]').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text) {
             let qty = 1;
             let unit = 'secukupnya';
             let name = text;
             
             // Simple regex to parse numbers at the start of ingredient (e.g. "2 siung bawang merah")
             const match = text.match(/^([\d.,\/]+)\s*([a-zA-Z]+)?\s*(.*)$/);
             if (match) {
                 qty = parseFloat(match[1].replace(',', '.')) || 1;
                 unit = match[2] ? match[2].toLowerCase() : 'secukupnya';
                 name = match[3] ? match[3].trim() : text;
             }
             
             scrapedIngredients.push({ name, qty, unit });
        }
    });

    await client.query('BEGIN');

    // 1. Create the Recipe
    const { rows: recipeRows } = await client.query(
      'INSERT INTO recipes (name, description, category, source_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, 'Imported from Cookpad', category || 'Lauk', url]
    );
    const recipe = recipeRows[0];
    
    const savedIngredients = [];

    // 2. Process and Map Ingredients
    for (const ing of scrapedIngredients) {
      if (!ing.name) continue;
      
      // Try to find if ingredient exists
      let ingredient_id;
      const { rows: existingIng } = await client.query(
          'SELECT id, unit FROM ingredients WHERE name ILIKE $1 LIMIT 1',
          [`%${ing.name.substring(0, 15)}%`] // basic fuzzy match
      );

      if (existingIng.length > 0) {
          ingredient_id = existingIng[0].id;
      } else {
          // Create new ingredient with price 0
          const { rows: newIng } = await client.query(
              "INSERT INTO ingredients (name, unit, price_per_unit, category) VALUES ($1, $2, 0, 'Lainnya') RETURNING id",
              [ing.name, ing.unit]
          );
          ingredient_id = newIng[0].id;
      }

      // Link ingredient to recipe
      await client.query(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity_per_person, custom_unit, name) VALUES ($1, $2, $3, $4, $5)',
          [recipe.id, ingredient_id, ing.qty, ing.unit, ing.name]
      );
      
      savedIngredients.push({ ingredient_id, quantity_per_person: ing.qty, custom_unit: ing.unit, name: ing.name });
    }

    await client.query('COMMIT');
    
    res.status(201).json({ 
        message: 'Successfully imported recipe',
        recipe: { ...recipe, ingredients: savedIngredients }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
