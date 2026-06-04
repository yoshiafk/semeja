const { pool } = require('./db');

/**
 * Auto-generate a weekly Bekal Sehat plan from the recipe pool.
 * 
 * Algorithm:
 * 1. Get recently used recipe pool IDs (last 2 weeks) for anti-repetition
 * 2. Get available pool recipes, grouped by category + bumbu
 * 3. Generate a balanced bumbu schedule (no same bumbu for protein+sayuran on same day)
 * 4. Pick recipes matching the bumbu schedule, excluding recently used ones
 * 5. Create the plan with days, recipes, ingredients, and steps
 */

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Get the next Monday from a given date string.
 */
function getNextMonday(fromDateStr) {
  const d = new Date(fromDateStr);
  const day = d.getDay(); // 0=Sun,1=Mon,...
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day);
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().split('T')[0];
}

/**
 * Fisher-Yates shuffle.
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate a balanced bumbu schedule for 7 days.
 * Constraint: protein.bumbu !== sayuran.bumbu on the same day.
 * Target: roughly equal bumbu usage across all 14 slots.
 */
function generateBumbuSchedule() {
  const bumbus = ['merah', 'putih', 'kuning'];

  // Create 7 day-slots with rotated bumbu assignments
  // Each bumbu appears ~4-5 times across 14 total slots (7 protein + 7 sayuran)
  const schedule = [];
  for (let day = 0; day < 7; day++) {
    const proteinBumbu = bumbus[day % 3];
    const sayuranBumbu = bumbus[(day + 1) % 3]; // offset by 1 to avoid collision
    schedule.push({ protein: proteinBumbu, sayuran: sayuranBumbu });
  }

  // Shuffle the day order for variety between weeks
  return shuffle(schedule);
}

/**
 * Generate the auto-incremented week label.
 */
async function generateWeekLabel(startDate) {
  const { rows } = await pool.query(
    'SELECT week_label FROM bekal_plans ORDER BY start_date DESC LIMIT 1'
  );

  let lastWeekNum = 0;
  if (rows.length > 0) {
    const match = rows[0].week_label.match(/(\d+)/);
    if (match) lastWeekNum = parseInt(match[1], 10);
  }

  const monthName = new Date(startDate).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
  return `Minggu ${lastWeekNum + 1} - ${monthName}`;
}

// ── Main Generator ───────────────────────────────────────────────────

/**
 * Generate a complete weekly bekal plan.
 * @param {string} startDate - ISO date string for the Monday start (e.g. '2026-06-08')
 * @returns {object} The created plan row
 */
async function generateWeeklyPlan(startDate) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get bumbu ID mapping
    const { rows: bumbuRows } = await client.query('SELECT id, color FROM bekal_bumbu_dasar');
    const bumbuByColor = {};
    bumbuRows.forEach(b => { bumbuByColor[b.color] = b.id; });

    // 2. Get recently used pool IDs (last 2 weeks = last 2 plans)
    const { rows: recentRows } = await client.query(`
      SELECT DISTINCT br.source_pool_id
      FROM bekal_recipes br
      JOIN bekal_days bd ON br.day_id = bd.id
      JOIN bekal_plans bp ON bd.plan_id = bp.id
      WHERE bp.start_date >= CURRENT_DATE - INTERVAL '14 days'
        AND br.source_pool_id IS NOT NULL
    `);
    const recentlyUsed = new Set(recentRows.map(r => r.source_pool_id));

    // 3. Get all pool recipes with ingredients and steps
    const { rows: allPoolRecipes } = await client.query(`
      SELECT rp.*, bbd.color as bumbu_color
      FROM bekal_recipe_pool rp
      LEFT JOIN bekal_bumbu_dasar bbd ON rp.bumbu_dasar_id = bbd.id
      ORDER BY rp.id
    `);

    // Group by category + bumbu
    const poolMap = {
      protein: { merah: [], putih: [], kuning: [] },
      sayuran: { merah: [], putih: [], kuning: [] },
    };

    for (const recipe of allPoolRecipes) {
      const cat = recipe.category;
      const bumbu = recipe.bumbu_color;
      if (poolMap[cat] && poolMap[cat][bumbu]) {
        // Prioritize non-recently-used recipes
        if (!recentlyUsed.has(recipe.id)) {
          poolMap[cat][bumbu].push(recipe);
        }
      }
    }

    // If any group is empty (all were recently used), allow recycling from oldest
    for (const cat of ['protein', 'sayuran']) {
      for (const bumbu of ['merah', 'putih', 'kuning']) {
        if (poolMap[cat][bumbu].length === 0) {
          poolMap[cat][bumbu] = allPoolRecipes.filter(
            r => r.category === cat && r.bumbu_color === bumbu
          );
        }
        // Shuffle for randomization
        poolMap[cat][bumbu] = shuffle(poolMap[cat][bumbu]);
      }
    }

    // 4. Generate bumbu schedule
    const schedule = generateBumbuSchedule();
    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    // Track which pool IDs we pick this week to avoid intra-week duplicates
    const usedThisWeek = new Set();

    // Helper to categorize protein type
    const getProteinType = (name) => {
      if (/ayam|ikan|sosis|daging|sapi/i.test(name)) return 'meat';
      if (/telur/i.test(name)) return 'egg';
      return 'plant';
    };

    let plantCount = 0;
    let eggCount = 0;
    let meatCount = 0;

    // 5. Pick recipes for each day
    const weekMenu = [];
    for (let i = 0; i < 7; i++) {
      const { protein: pBumbu, sayuran: sBumbu } = schedule[i];

      // --- PICK PROTEIN ---
      let proteinRecipe = null;
      
      const findConstrainedCandidate = (candidates) => {
        let valid = candidates;
        if (plantCount >= 2) valid = valid.filter(r => getProteinType(r.name) !== 'plant');
        if (eggCount >= 2) valid = valid.filter(r => getProteinType(r.name) !== 'egg');
        const daysLeft = 7 - i;
        const meatsNeeded = 3 - meatCount;
        if (meatsNeeded >= daysLeft) {
          const meatOnly = valid.filter(r => getProteinType(r.name) === 'meat');
          if (meatOnly.length > 0) valid = meatOnly;
        }
        return valid.length > 0 ? valid[0] : null;
      };

      // 1. Try target bumbu with constraints
      let pCandidates = poolMap.protein[pBumbu].filter(r => !usedThisWeek.has(r.id));
      proteinRecipe = findConstrainedCandidate(pCandidates);

      // 2. Fallback to other bumbu with constraints
      if (!proteinRecipe) {
        for (const b of ['merah', 'putih', 'kuning']) {
          pCandidates = poolMap.protein[b].filter(r => !usedThisWeek.has(r.id));
          proteinRecipe = findConstrainedCandidate(pCandidates);
          if (proteinRecipe) break;
        }
      }

      // 3. Last resort: ignore constraints and pick anything from target bumbu
      if (!proteinRecipe) {
        pCandidates = poolMap.protein[pBumbu].filter(r => !usedThisWeek.has(r.id));
        proteinRecipe = pCandidates[0];
      }

      // 4. Ultimate last resort: ignore constraints and pick anything
      if (!proteinRecipe) {
        for (const b of ['merah', 'putih', 'kuning']) {
          pCandidates = poolMap.protein[b].filter(r => !usedThisWeek.has(r.id));
          proteinRecipe = pCandidates[0];
          if (proteinRecipe) break;
        }
      }

      // Pick sayuran
      let sayuranRecipe = poolMap.sayuran[sBumbu].find(r => !usedThisWeek.has(r.id));
      if (!sayuranRecipe) {
        for (const b of ['merah', 'putih', 'kuning']) {
          sayuranRecipe = poolMap.sayuran[b].find(r => !usedThisWeek.has(r.id));
          if (sayuranRecipe) break;
        }
      }

      if (proteinRecipe) {
        usedThisWeek.add(proteinRecipe.id);
        const type = getProteinType(proteinRecipe.name);
        if (type === 'plant') plantCount++;
        else if (type === 'egg') eggCount++;
        else meatCount++;
      }
      if (sayuranRecipe) usedThisWeek.add(sayuranRecipe.id);

      weekMenu.push({
        dayNumber: i + 1,
        dayName: dayNames[i],
        protein: proteinRecipe,
        sayuran: sayuranRecipe,
      });
    }

    // 6. Create the plan
    const weekLabel = await generateWeekLabel(startDate);
    const today = new Date().toISOString().split('T')[0];
    const status = startDate <= today ? 'active' : 'upcoming';

    const { rows: planRows } = await client.query(
      `INSERT INTO bekal_plans (title, description, start_date, week_label, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        `Menu Bekal Sehat ${weekLabel}`,
        'Menu bekal sehat yang di-generate otomatis dengan variasi bumbu dasar merah, putih, dan kuning. Protein dan sayuran seimbang setiap hari.',
        startDate,
        weekLabel,
        status,
      ]
    );
    const plan = planRows[0];

    // 7. Create days and copy recipes from pool
    for (const day of weekMenu) {
      const { rows: dayRows } = await client.query(
        `INSERT INTO bekal_days (plan_id, day_number, day_name) VALUES ($1, $2, $3) RETURNING id`,
        [plan.id, day.dayNumber, day.dayName]
      );
      const dayId = dayRows[0].id;

      // Insert both recipes
      for (const [idx, poolRecipe] of [day.protein, day.sayuran].entries()) {
        if (!poolRecipe) continue;

        const category = idx === 0 ? 'protein' : 'sayuran';
        const { rows: recipeRows } = await client.query(
          `INSERT INTO bekal_recipes (day_id, name, description, category, bumbu_dasar_id, estimasi_waktu, kalori_estimasi, tips_bekal, sort_order, source_pool_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [dayId, poolRecipe.name, poolRecipe.description, category, poolRecipe.bumbu_dasar_id, poolRecipe.estimasi_waktu, poolRecipe.kalori_estimasi, poolRecipe.tips_bekal, idx, poolRecipe.id]
        );
        const recipeId = recipeRows[0].id;

        // Copy ingredients from pool using INSERT ... SELECT
        await client.query(
          `INSERT INTO bekal_recipe_ingredients (recipe_id, name, quantity_per_portion, unit, is_bumbu_dasar, sort_order)
           SELECT $1, name, quantity_per_portion, unit, is_bumbu_dasar, sort_order
           FROM bekal_pool_ingredients
           WHERE pool_recipe_id = $2`,
          [recipeId, poolRecipe.id]
        );

        // Copy steps from pool using INSERT ... SELECT
        await client.query(
          `INSERT INTO bekal_recipe_steps (recipe_id, step_number, instruction)
           SELECT $1, step_number, instruction
           FROM bekal_pool_steps
           WHERE pool_recipe_id = $2`,
          [recipeId, poolRecipe.id]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Auto-generated bekal plan: "${plan.title}" (${plan.status}), start: ${startDate}`);
    return plan;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error generating weekly bekal plan:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ── Status Sync ──────────────────────────────────────────────────────

/**
 * Synchronize plan statuses based on current date.
 * - upcoming → active when start_date <= today
 * - active → archived when start_date + 7 days <= today
 * Also triggers auto-generation of next week's plan on Thursday+.
 */
async function syncPlanStatuses() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Archive expired active plans
  await pool.query(`
    UPDATE bekal_plans SET status = 'archived'
    WHERE status = 'active' AND start_date + INTERVAL '7 days' <= $1::date
  `, [today]);

  // 2. Activate upcoming plans whose week has started
  await pool.query(`
    UPDATE bekal_plans SET status = 'active'
    WHERE status = 'upcoming' AND start_date <= $1::date
  `, [today]);

  // 3. Auto-generate next week if needed (Thursday+ trigger)
  const todayDate = new Date(today);
  const dayOfWeek = todayDate.getDay(); // 0=Sun, 4=Thu

  // Thursday(4), Friday(5), Saturday(6), Sunday(0)
  if (dayOfWeek >= 4 || dayOfWeek === 0) {
    const nextMonday = getNextMonday(today);

    // Check if next week's plan already exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM bekal_plans WHERE start_date = $1 AND status IN ('upcoming', 'active')`,
      [nextMonday]
    );

    if (existing.length === 0) {
      // Check that pool has recipes before generating
      const { rows: poolCheck } = await pool.query('SELECT id FROM bekal_recipe_pool LIMIT 1');
      if (poolCheck.length > 0) {
        try {
          await generateWeeklyPlan(nextMonday);
        } catch (err) {
          console.error('Auto-generation failed:', err.message);
        }
      }
    }
  }
}

module.exports = { generateWeeklyPlan, syncPlanStatuses, getNextMonday };
