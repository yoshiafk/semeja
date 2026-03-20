const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { calculateMealEstimate } = require('../lib/cost-calculator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { convertToWeight } = require('../lib/units');
const { createShoppingListSnapshot } = require('../lib/snapshot');

// ── Status lifecycle validator ────────────────────────────────
const VALID_TRANSITIONS = {
  draft:    ['proposed', 'archived'],
  proposed: ['active', 'draft'],
  active:   ['shopping', 'archived'],
  shopping: ['closed', 'active'],
  closed:   ['archived'],
  archived: [],  // terminal
};

function canTransition(from, to) {
  const current = from || 'active'; // treat legacy null statuses as active
  return VALID_TRANSITIONS[current]?.includes(to) ?? false;
}

// GET all meal plans (batch query instead of N+1)
router.get('/', async (req, res) => {
  try {
    const { rows: plans } = await pool.query('SELECT * FROM meal_plans ORDER BY week_start DESC');
    const planIds = plans.map(p => p.id);
    let allMeals = [];
    if (planIds.length > 0) {
      const { rows: meals } = await pool.query(
        `SELECT m.*,
          (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
         FROM meals m WHERE m.meal_plan_id = ANY($1::int[]) ORDER BY m.date`,
        [planIds]
      );
      const { rows: items } = await pool.query(
        'SELECT * FROM meal_menu_items WHERE meal_id = ANY($1::int[]) ORDER BY sort_order ASC',
        [meals.map(m => m.id)]
      );
      for (const meal of meals) {
        meal.items = items.filter(it => it.meal_id === meal.id);
      }
      allMeals = meals;
    }
    for (const plan of plans) {
      plan.meals = allMeals.filter(m => m.meal_plan_id === plan.id);
    }
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET active (or currently live) meal plans
router.get('/active', async (req, res) => {
  try {
    const { rows: plans } = await pool.query(
      `SELECT * FROM meal_plans
       WHERE status IN ('active', 'shopping', 'proposed', 'draft')
       ORDER BY week_start ASC`
    );
    const planIds = plans.map(p => p.id);
    let allMeals = [];
    if (planIds.length > 0) {
      const { rows: meals } = await pool.query(
        `SELECT m.*,
          (SELECT COUNT(*) FROM participations p WHERE p.meal_id = m.id) as participant_count
         FROM meals m WHERE m.meal_plan_id = ANY($1::int[]) ORDER BY m.date`,
        [planIds]
      );
      const { rows: items } = await pool.query(
        'SELECT * FROM meal_menu_items WHERE meal_id = ANY($1::int[]) ORDER BY sort_order ASC',
        [meals.map(m => m.id)]
      );
      for (const meal of meals) {
        meal.items = items.filter(it => it.meal_id === meal.id);
      }
      allMeals = meals;
    }
    for (const plan of plans) {
      plan.meals = allMeals.filter(m => m.meal_plan_id === plan.id);
    }
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new meal plan (auto-generates 7 days)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { week_start } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const startDate = new Date(week_start);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const { rows } = await client.query(
      'INSERT INTO meal_plans (week_start, week_end) VALUES ($1, $2) RETURNING *',
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );
    const plan = rows[0];

    const daysInIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayName = daysInIndonesian[d.getDay()];
      await client.query(
        'INSERT INTO meals (meal_plan_id, date, day_name) VALUES ($1, $2, $3)',
        [plan.id, d.toISOString().split('T')[0], dayName]
      );
    }

    await client.query('COMMIT');
    const { rows: meals } = await pool.query(
      'SELECT * FROM meals WHERE meal_plan_id = $1 ORDER BY date', [plan.id]
    );
    plan.meals = meals;
    res.status(201).json(plan);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update meal plan status / lifecycle
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status, rsvp_deadline } = req.body;
  const planId = parseInt(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current plan
    const { rows: current } = await client.query(
      'SELECT * FROM meal_plans WHERE id = $1', [planId]
    );
    if (!current.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const currentPlan = current[0];

    // Validate transition if status is being changed
    if (status && status !== currentPlan.status && !canTransition(currentPlan.status, status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot transition from '${currentPlan.status}' to '${status}'`
      });
    }

    // Build update fields dynamically
    const updates = {};
    if (status) updates.status = status;

    if (status === 'proposed') {
      updates.proposed_at = new Date().toISOString();
      if (rsvp_deadline) updates.rsvp_deadline = rsvp_deadline;
    }
    if (status === 'shopping') {
      updates.locked_at = new Date().toISOString();
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [planId, ...Object.values(updates)];

    const { rows } = await client.query(
      `UPDATE meal_plans SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    );
    const plan = rows[0];

    // Trigger shopping list snapshot when moving to 'shopping'
    if (status === 'shopping') {
      try {
        await createShoppingListSnapshot(pool, planId);
      } catch (snapErr) {
        console.warn('[snapshot] Failed to create snapshot:', snapErr.message);
        // Non-fatal — don't block the transition
      }
    }

    // Existing cost reconciliation on archive
    if (status === 'archived') {
      try {
        await reconcilePlanCosts(client, planId);
      } catch (reconcileErr) {
        console.warn('[reconcile] Failed to settle costs:', reconcileErr.message);
      }
    }

    await client.query('COMMIT');
    res.json(plan);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET settlement data for an archived plan
router.get('/:id/settlement', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pms.*, m.name as member_name
       FROM plan_member_settlements pms
       JOIN members m ON pms.member_id = m.id
       WHERE pms.meal_plan_id = $1
       ORDER BY pms.actual_cost DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE meal plan
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM meal_plans WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/react — member RSVP reaction on a proposed plan
router.post('/:id/react', requireAuth, async (req, res) => {
  const { meal_id, reaction, member_id } = req.body;
  if (!meal_id || !reaction || !member_id) {
    return res.status(400).json({ error: 'meal_id, reaction, and member_id are required' });
  }
  if (!['join', 'skip', 'unsure'].includes(reaction)) {
    return res.status(400).json({ error: 'reaction must be join, skip, or unsure' });
  }
  try {
    await pool.query(
      `INSERT INTO plan_reactions (plan_id, meal_id, member_id, reaction)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (meal_id, member_id)
       DO UPDATE SET reaction = EXCLUDED.reaction`,
      [req.params.id, meal_id, member_id, reaction]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/reactions — get all reactions for a plan
router.get('/:id/reactions', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, m.name as member_name, ml.day_name, ml.date
       FROM plan_reactions pr
       JOIN members m ON pr.member_id = m.id
       JOIN meals ml ON pr.meal_id = ml.id
       WHERE pr.plan_id = $1
       ORDER BY ml.date, m.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/lock — convert 'join' reactions into participations, then move to 'active'
router.post('/:id/lock', requireAuth, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: joinReactions } = await client.query(
      `SELECT * FROM plan_reactions
       WHERE plan_id = $1 AND reaction = 'join'`,
      [req.params.id]
    );

    for (const reaction of joinReactions) {
      await client.query(
        `INSERT INTO participations (meal_id, member_id)
         VALUES ($1, $2)
         ON CONFLICT (meal_id, member_id) DO NOTHING`,
        [reaction.meal_id, reaction.member_id]
      );
    }

    await client.query(
      `UPDATE meal_plans SET status = 'active' WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, participations_created: joinReactions.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

// ── Helper: reconcile costs when a plan is archived ──────────────────────────
/**
 * Computes how much each member actually owes based on real purchase data,
 * distributing the total actual spend proportionally by days_joined.
 * Writes results to plan_member_settlements (upsert so it's safe to re-run).
 *
 * @param {object} client - pg transaction client
 * @param {number} planId
 */
async function reconcilePlanCosts(client, planId) {
  // 1. Get total actual spend for the plan
  const { rows: purchaseRows } = await client.query(
    `SELECT COALESCE(SUM(total_price), 0) as total_actual
     FROM purchases WHERE meal_plan_id = $1`,
    [planId]
  );
  const totalActual = parseFloat(purchaseRows[0].total_actual) || 0;

  // 2. Get all meals with participant counts
  const { rows: meals } = await client.query(
    `SELECT m.id, m.date, m.requires_rice,
            COUNT(p.id)::int as participant_count
     FROM meals m
     LEFT JOIN participations p ON p.meal_id = m.id
     WHERE m.meal_plan_id = $1
     GROUP BY m.id, m.date, m.requires_rice
     ORDER BY m.date`,
    [planId]
  );

  // 3. Get all participations (member × meal)
  const { rows: participations } = await client.query(
    `SELECT p.member_id, p.meal_id, mem.name as member_name
     FROM participations p
     JOIN members mem ON p.member_id = mem.id
     JOIN meals m ON p.meal_id = m.id
     WHERE m.meal_plan_id = $1`,
    [planId]
  );

  // 4. Build per-member summary
  const memberTotals = {};

  for (const meal of meals) {
    const pCount = meal.participant_count;
    if (pCount === 0) continue;

    const dayParticipants = participations.filter(p => p.meal_id === meal.id);
    for (const p of dayParticipants) {
      if (!memberTotals[p.member_id]) {
        memberTotals[p.member_id] = {
          member_id: p.member_id,
          days_joined: 0,
          estimated_cost: 0,
          actual_cost: 0,
        };
      }
      memberTotals[p.member_id].days_joined += 1;
    }
  }

  // 6. Distribute ACTUAL total spend proportionally by days_joined
  const totalDays = Object.values(memberTotals).reduce((s, m) => s + m.days_joined, 0);
  if (totalDays > 0) {
    Object.values(memberTotals).forEach(m => {
      m.actual_cost = Math.round((m.days_joined / totalDays) * totalActual);
    });
  }

  // 7. Upsert into plan_member_settlements
  for (const m of Object.values(memberTotals)) {
    await client.query(
      `INSERT INTO plan_member_settlements
         (meal_plan_id, member_id, days_joined, estimated_cost, actual_cost)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (meal_plan_id, member_id) DO UPDATE SET
         days_joined    = EXCLUDED.days_joined,
         estimated_cost = EXCLUDED.estimated_cost,
         actual_cost    = EXCLUDED.actual_cost,
         settled_at     = NOW()`,
      [planId, m.member_id, m.days_joined, m.estimated_cost, m.actual_cost]
    );
  }
}
