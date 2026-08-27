const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { syncPlanStatuses, generateWeeklyPlan, getNextMonday } = require('../auto-generate-bekal');

const router = express.Router();

// ── GET /api/bekal-sehat/bumbu-dasar ──────────────────────────────────
// Get all bumbu dasar with ingredients
router.get('/bumbu-dasar', async (req, res) => {
  try {
    const { rows: bumbuList } = await pool.query(
      'SELECT * FROM bekal_bumbu_dasar ORDER BY id'
    );

    if (bumbuList.length > 0) {
      const bumbuIds = bumbuList.map(b => b.id);
      const { rows: allIngredients } = await pool.query(
        'SELECT * FROM bekal_bumbu_ingredients WHERE bumbu_id = ANY($1::int[]) ORDER BY sort_order',
        [bumbuIds]
      );
      
      bumbuList.forEach(bumbu => {
        bumbu.ingredients = allIngredients.filter(ing => ing.bumbu_id === bumbu.id);
      });
    }

    res.json(bumbuList);
  } catch (error) {
    console.error('Error fetching bumbu dasar:', error);
    res.status(500).json({ error: 'Failed to fetch bumbu dasar' });
  }
});

let lastSync = 0;

// ── GET /api/bekal-sehat/plans ────────────────────────────────────────
// Get all plans. Supports ?visibility=member to filter for member view.
router.get('/plans', async (req, res) => {
  try {
    // Auto-transition statuses & auto-generate next week if needed
    if (Date.now() - lastSync > 300000) {
      lastSync = Date.now();
      syncPlanStatuses().catch(err => console.error('Error in syncPlanStatuses:', err));
    }

    const { visibility } = req.query;
    let statusFilter = '';
    if (visibility === 'member') {
      // Members see active + upcoming plans only
      statusFilter = `WHERE bp.status IN ('active', 'upcoming')`;
    }

    const { rows } = await pool.query(`
      SELECT bp.*, m.name as creator_name,
        CAST(COALESCE(count(DISTINCT bpart.member_id), 0) AS INTEGER) as participant_count
      FROM bekal_plans bp
      LEFT JOIN members m ON bp.created_by = m.id
      LEFT JOIN bekal_participations bpart ON bp.id = bpart.plan_id
      ${statusFilter}
      GROUP BY bp.id, m.name
      ORDER BY 
        CASE bp.status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
        bp.start_date DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching bekal plans:', error);
    res.status(500).json({ error: 'Failed to fetch bekal plans' });
  }
});

// ── GET /api/bekal-sehat/plans/:id ────────────────────────────────────
// Get full plan detail with days, recipes, ingredients, steps
router.get('/plans/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Plan
    const { rows: planRows } = await pool.query(
      `SELECT bp.*, m.name as creator_name 
       FROM bekal_plans bp LEFT JOIN members m ON bp.created_by = m.id 
       WHERE bp.id = $1`,
      [id]
    );
    if (planRows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = planRows[0];

    // Fetch all related data in parallel batch queries!
    const [
      { rows: days },
      { rows: recipes },
      { rows: ingredients },
      { rows: steps },
      { rows: participants }
    ] = await Promise.all([
      pool.query('SELECT * FROM bekal_days WHERE plan_id = $1 ORDER BY day_number', [id]),
      pool.query(`
        SELECT br.*, bbd.name as bumbu_dasar_name, bbd.color as bumbu_dasar_color
        FROM bekal_recipes br
        JOIN bekal_days bd ON br.day_id = bd.id
        LEFT JOIN bekal_bumbu_dasar bbd ON br.bumbu_dasar_id = bbd.id
        WHERE bd.plan_id = $1 ORDER BY br.sort_order
      `, [id]),
      pool.query(`
        SELECT bri.* 
        FROM bekal_recipe_ingredients bri
        JOIN bekal_recipes br ON bri.recipe_id = br.id
        JOIN bekal_days bd ON br.day_id = bd.id
        WHERE bd.plan_id = $1 ORDER BY bri.sort_order
      `, [id]),
      pool.query(`
        SELECT brs.* 
        FROM bekal_recipe_steps brs
        JOIN bekal_recipes br ON brs.recipe_id = br.id
        JOIN bekal_days bd ON br.day_id = bd.id
        WHERE bd.plan_id = $1 ORDER BY brs.step_number
      `, [id]),
      pool.query(`
        SELECT bpart.*, m.name as member_name
        FROM bekal_participations bpart
        JOIN members m ON bpart.member_id = m.id
        WHERE bpart.plan_id = $1 ORDER BY bpart.joined_at
      `, [id])
    ]);

    // Assemble in memory
    const recipesMap = new Map();
    recipes.forEach(r => {
      r.ingredients = [];
      r.steps = [];
      recipesMap.set(r.id, r);
    });

    ingredients.forEach(ing => {
      if (recipesMap.has(ing.recipe_id)) recipesMap.get(ing.recipe_id).ingredients.push(ing);
    });

    steps.forEach(step => {
      if (recipesMap.has(step.recipe_id)) recipesMap.get(step.recipe_id).steps.push(step);
    });

    const daysMap = new Map();
    days.forEach(d => {
      d.recipes = [];
      daysMap.set(d.id, d);
    });

    recipes.forEach(r => {
      if (daysMap.has(r.day_id)) daysMap.get(r.day_id).recipes.push(r);
    });

    res.json({ ...plan, days, participants });
  } catch (error) {
    console.error('Error fetching bekal plan detail:', error);
    res.status(500).json({ error: 'Failed to fetch plan detail' });
  }
});

// ── POST /api/bekal-sehat/plans ───────────────────────────────────────
// Create a new plan (admin only) — status auto-set based on start_date
router.post('/plans', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, start_date, week_label } = req.body;
  if (!title || !week_label || !start_date) {
    return res.status(400).json({ error: 'title, start_date, and week_label are required' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const autoStatus = start_date > today ? 'upcoming' : 'active';

    const { rows } = await pool.query(
      `INSERT INTO bekal_plans (title, description, start_date, week_label, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description || '', start_date, week_label, autoStatus, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating bekal plan:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// ── POST /api/bekal-sehat/plans/generate ──────────────────────────────
// Force-generate next week's plan (admin trigger)
router.post('/plans/generate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nextMonday = getNextMonday(today);

    // Check if already exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM bekal_plans WHERE start_date = $1 AND status IN ('upcoming', 'active')`,
      [nextMonday]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Plan for next week already exists', plan_id: existing[0].id });
    }

    const plan = await generateWeeklyPlan(nextMonday);
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error generating bekal plan:', error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ── PUT /api/bekal-sehat/plans/:id ────────────────────────────────────
// Update plan metadata
router.put('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, description, start_date, week_label, status } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE bekal_plans 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           start_date = COALESCE($3, start_date),
           week_label = COALESCE($4, week_label),
           status = COALESCE($5, status)
       WHERE id = $6 RETURNING *`,
      [title, description, start_date, week_label, status, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating bekal plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// ── DELETE /api/bekal-sehat/plans/:id ─────────────────────────────────
router.delete('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('DELETE FROM bekal_plans WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    res.json({ message: 'Plan deleted successfully', plan: rows[0] });
  } catch (error) {
    console.error('Error deleting bekal plan:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// ── POST /api/bekal-sehat/plans/:id/days ──────────────────────────────
// Add/update a full day with recipes (admin only)
router.post('/plans/:id/days', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { day_number, day_name, recipes } = req.body;

  if (!day_number || !day_name || !Array.isArray(recipes)) {
    return res.status(400).json({ error: 'day_number, day_name, and recipes[] are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert day
    const { rows: dayRows } = await client.query(
      `INSERT INTO bekal_days (plan_id, day_number, day_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (plan_id, day_number) DO UPDATE SET day_name = $3
       RETURNING id`,
      [id, day_number, day_name]
    );
    const dayId = dayRows[0].id;

    // Delete existing recipes for this day
    await client.query('DELETE FROM bekal_recipes WHERE day_id = $1', [dayId]);

    // Insert new recipes
    for (let i = 0; i < recipes.length; i++) {
      const r = recipes[i];
      const { rows: recipeRows } = await client.query(
        `INSERT INTO bekal_recipes (day_id, name, description, category, bumbu_dasar_id, estimasi_waktu, kalori_estimasi, tips_bekal, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [dayId, r.name, r.description || '', r.category, r.bumbu_dasar_id || null, r.estimasi_waktu || 30, r.kalori_estimasi || 0, r.tips_bekal || '', i]
      );
      const recipeId = recipeRows[0].id;

      // Insert ingredients
      if (Array.isArray(r.ingredients)) {
        for (let j = 0; j < r.ingredients.length; j++) {
          const ing = r.ingredients[j];
          await client.query(
            `INSERT INTO bekal_recipe_ingredients (recipe_id, name, quantity_per_portion, unit, is_bumbu_dasar, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [recipeId, ing.name, ing.quantity_per_portion, ing.unit, ing.is_bumbu_dasar || false, j]
          );
        }
      }

      // Insert steps
      if (Array.isArray(r.steps)) {
        for (let k = 0; k < r.steps.length; k++) {
          await client.query(
            `INSERT INTO bekal_recipe_steps (recipe_id, step_number, instruction) VALUES ($1, $2, $3)`,
            [recipeId, k + 1, r.steps[k]]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Day created successfully', day_id: dayId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating bekal day:', error);
    res.status(500).json({ error: 'Failed to create day' });
  } finally {
    client.release();
  }
});

// ── POST /api/bekal-sehat/plans/:id/join ──────────────────────────────
// Join a plan with portion count
router.post('/plans/:id/join', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { member_id, portions } = req.body;

  if (!member_id) return res.status(400).json({ error: 'member_id is required' });

  if (req.user.role !== 'admin' && req.user.id !== parseInt(member_id)) {
    return res.status(403).json({ error: 'Cannot join on behalf of another user' });
  }

  const portionCount = Math.min(10, Math.max(1, parseInt(portions) || 1));

  try {
    const { rows } = await pool.query(
      `INSERT INTO bekal_participations (plan_id, member_id, portions)
       VALUES ($1, $2, $3)
       ON CONFLICT (plan_id, member_id) DO UPDATE SET portions = $3
       RETURNING *`,
      [id, member_id, portionCount]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error joining bekal plan:', error);
    res.status(500).json({ error: 'Failed to join plan' });
  }
});

// ── POST /api/bekal-sehat/plans/:id/leave ─────────────────────────────
// Leave a plan
router.post('/plans/:id/leave', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { member_id } = req.body;

  if (!member_id) return res.status(400).json({ error: 'member_id is required' });

  if (req.user.role !== 'admin' && req.user.id !== parseInt(member_id)) {
    return res.status(403).json({ error: 'Cannot leave on behalf of another user' });
  }

  try {
    await pool.query(
      'DELETE FROM bekal_participations WHERE plan_id = $1 AND member_id = $2',
      [id, member_id]
    );
    res.json({ message: 'Successfully left the plan' });
  } catch (error) {
    console.error('Error leaving bekal plan:', error);
    res.status(500).json({ error: 'Failed to leave plan' });
  }
});

module.exports = router;
