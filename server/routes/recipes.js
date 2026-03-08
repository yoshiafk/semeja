const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all recipes with ingredients
router.get('/', async (req, res) => {
  try {
    const { rows: recipes } = await pool.query('SELECT * FROM recipes ORDER BY name');
    for (const recipe of recipes) {
      const { rows: ingredients } = await pool.query(
        `SELECT ri.*, i.name, i.unit, i.price_per_unit, i.category
         FROM recipe_ingredients ri
         JOIN ingredients i ON ri.ingredient_id = i.id
         WHERE ri.recipe_id = $1
         ORDER BY i.name`,
        [recipe.id]
      );
      recipe.ingredients = ingredients;
    }
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single recipe with ingredients
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const recipe = rows[0];
    const { rows: ingredients } = await pool.query(
      `SELECT ri.*, i.name, i.unit, i.price_per_unit, i.category
       FROM recipe_ingredients ri
       JOIN ingredients i ON ri.ingredient_id = i.id
       WHERE ri.recipe_id = $1
       ORDER BY i.name`,
      [recipe.id]
    );
    recipe.ingredients = ingredients;
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new recipe with ingredients
router.post('/', async (req, res) => {
  const { name, description, ingredients, category, source_url } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO recipes (name, description, category, source_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), description || '', category || 'Lauk', source_url || '']
    );
    const recipe = rows[0];
    if (ingredients && ingredients.length) {
      for (const ing of ingredients) {
        await client.query(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity_per_person) VALUES ($1, $2, $3)',
          [recipe.id, ing.ingredient_id, ing.quantity_per_person]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(recipe);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update recipe
router.put('/:id', async (req, res) => {
  const { name, description, ingredients, category, source_url } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE recipes SET name = COALESCE($1, name), description = COALESCE($2, description), category = COALESCE($3, category), source_url = COALESCE($4, source_url) WHERE id = $5 RETURNING *',
      [name, description, category, source_url, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (ingredients) {
      await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [req.params.id]);
      for (const ing of ingredients) {
        await client.query(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity_per_person) VALUES ($1, $2, $3)',
          [req.params.id, ing.ingredient_id, ing.quantity_per_person]
        );
      }
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE recipe
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM recipes WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
