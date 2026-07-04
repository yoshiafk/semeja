const { pool } = require('./db');

/**
 * Auto-generate a 5-day (Mon-Fri) Bekal Sehat plan from the recipe pool.
 *
 * Algorithm:
 * 1. Get recently used recipe pool IDs (last 2 weeks) for anti-repetition
 * 2. Get available pool recipes, grouped by category + bumbu (+ free-form bucket)
 * 3. Generate a balanced bumbu schedule for 5 days
 * 4. Pick recipes matching the schedule with protein quotas:
 *    - Ayam: minimum 3 out of 5 days
 *    - Plant (tempe/tahu): max 1 day
 *    - Egg (telur): max 1 day
 * 5. Create the plan with days, recipes, ingredients, and steps
 */

// ── Helpers ──────────────────────────────────────────────────────────

function getNextMonday(fromDateStr) {
  const d = new Date(fromDateStr);
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day);
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().split('T')[0];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate a balanced bumbu schedule for 5 days.
 * Each day: protein bumbu !== sayuran bumbu.
 */
function generateBumbuSchedule() {
  const bumbus = ['merah', 'putih', 'kuning'];
  const schedule = [];
  for (let day = 0; day < 5; day++) {
    const proteinBumbu = bumbus[day % 3];
    const sayuranBumbu = bumbus[(day + 1) % 3];
    schedule.push({ protein: proteinBumbu, sayuran: sayuranBumbu });
  }
  return shuffle(schedule);
}

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

async function generateWeeklyPlan(startDate) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get bumbu ID mapping
    const { rows: bumbuRows } = await client.query('SELECT id, color FROM bekal_bumbu_dasar');
    const bumbuByColor = {};
    bumbuRows.forEach(b => { bumbuByColor[b.color] = b.id; });

    // 2. Get recently used pool IDs (last 2 plans / ~2 weeks)
    const { rows: recentRows } = await client.query(`
      SELECT DISTINCT br.source_pool_id
      FROM bekal_recipes br
      JOIN bekal_days bd ON br.day_id = bd.id
      JOIN bekal_plans bp ON bd.plan_id = bp.id
      WHERE bp.start_date >= CURRENT_DATE - INTERVAL '14 days'
        AND br.source_pool_id IS NOT NULL
    `);
    const recentlyUsed = new Set(recentRows.map(r => r.source_pool_id));

    // 3. Get all pool recipes with bumbu color and protein_type
    const { rows: allPoolRecipes } = await client.query(`
      SELECT rp.*, bbd.color as bumbu_color
      FROM bekal_recipe_pool rp
      LEFT JOIN bekal_bumbu_dasar bbd ON rp.bumbu_dasar_id = bbd.id
      ORDER BY rp.id
    `);

    // Group by category + bumbu (also include 'free' bucket for bumbu-free recipes)
    const poolMap = {
      protein: { merah: [], putih: [], kuning: [], free: [] },
      sayuran: { merah: [], putih: [], kuning: [], free: [] },
    };

    for (const recipe of allPoolRecipes) {
      const cat = recipe.category;
      if (!poolMap[cat]) continue;
      const bucket = recipe.is_bumbu_free ? 'free' : (recipe.bumbu_color || 'free');
      if (!recentlyUsed.has(recipe.id)) {
        poolMap[cat][bucket].push(recipe);
      }
    }

    // If any bumbu bucket is empty, allow recycling from that bumbu
    for (const cat of ['protein', 'sayuran']) {
      for (const bucket of ['merah', 'putih', 'kuning', 'free']) {
        if (poolMap[cat][bucket].length === 0) {
          const fallback = allPoolRecipes.filter(r => {
            if (r.category !== cat) return false;
            const b = r.is_bumbu_free ? 'free' : (r.bumbu_color || 'free');
            return b === bucket;
          });
          poolMap[cat][bucket] = fallback;
        }
        poolMap[cat][bucket] = shuffle(poolMap[cat][bucket]);
      }
    }

    // 4. Generate bumbu schedule for 5 days
    const schedule = generateBumbuSchedule();
    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

    // Track picks this week (intra-week deduplication)
    const usedThisWeek = new Set();

    // Protein type counters & quotas (out of 5 days)
    const CHICKEN_MIN = 3;
    const PLANT_MAX = 1;
    const EGG_MAX = 1;
    let chickenCount = 0;
    let plantCount = 0;
    let eggCount = 0;

    const getProteinType = (recipe) => {
      if (recipe.protein_type) return recipe.protein_type;
      const name = recipe.name || '';
      if (/ayam/i.test(name)) return 'ayam';
      if (/ikan|dori|kakap/i.test(name)) return 'ikan';
      if (/telur/i.test(name)) return 'telur';
      if (/tempe/i.test(name)) return 'tempe';
      if (/tahu/i.test(name)) return 'tahu';
      return 'other';
    };

    const isPlant = (t) => t === 'tempe' || t === 'tahu';

    const weekMenu = [];

    /**
     * Find the best protein candidate respecting chicken/plant/egg quotas.
     */
    const findConstrainedProtein = (candidates) => {
      const i = weekMenu.length;
      const remaining = 5 - i;
      const chickenNeeded = CHICKEN_MIN - chickenCount;

      let valid = candidates.filter(r => !usedThisWeek.has(r.id));

      // Hard-block: must pick chicken if quota cannot be met otherwise
      if (chickenNeeded >= remaining && remaining > 0) {
        const chickenOnly = valid.filter(r => getProteinType(r) === 'ayam');
        if (chickenOnly.length > 0) return chickenOnly[0];
      }

      // Soft-block: exclude plant if over quota
      if (plantCount >= PLANT_MAX) {
        valid = valid.filter(r => !isPlant(getProteinType(r)));
      }
      // Soft-block: exclude egg if over quota
      if (eggCount >= EGG_MAX) {
        valid = valid.filter(r => getProteinType(r) !== 'telur');
      }

      // Prefer chicken if under quota (chicken candidates first)
      if (chickenCount < CHICKEN_MIN) {
        const chickenFirst = [
          ...valid.filter(r => getProteinType(r) === 'ayam'),
          ...valid.filter(r => getProteinType(r) !== 'ayam'),
        ];
        if (chickenFirst.length > 0) return chickenFirst[0];
      }

      return valid.length > 0 ? valid[0] : null;
    };

    // 5. Pick recipes for each of 5 days
    for (let i = 0; i < 5; i++) {
      const { protein: pBumbu, sayuran: sBumbu } = schedule[i];

      // --- PICK PROTEIN ---
      let proteinRecipe = null;
      const bucketsToTry = [pBumbu, ...['merah', 'putih', 'kuning', 'free'].filter(b => b !== pBumbu)];

      for (const bucket of bucketsToTry) {
        proteinRecipe = findConstrainedProtein(poolMap.protein[bucket]);
        if (proteinRecipe) break;
      }

      // Last resort: ignore quotas, pick anything unused
      if (!proteinRecipe) {
        for (const bucket of bucketsToTry) {
          const anyUnused = poolMap.protein[bucket].find(r => !usedThisWeek.has(r.id));
          if (anyUnused) { proteinRecipe = anyUnused; break; }
        }
      }

      // Update counters
      if (proteinRecipe) {
        usedThisWeek.add(proteinRecipe.id);
        const t = getProteinType(proteinRecipe);
        if (t === 'ayam') chickenCount++;
        else if (isPlant(t)) plantCount++;
        else if (t === 'telur') eggCount++;
      }

      // --- PICK SAYURAN ---
      let sayuranRecipe = null;
      const sayuranBuckets = [sBumbu, ...['merah', 'putih', 'kuning', 'free'].filter(b => b !== sBumbu)];

      for (const bucket of sayuranBuckets) {
        sayuranRecipe = poolMap.sayuran[bucket].find(r => !usedThisWeek.has(r.id));
        if (sayuranRecipe) break;
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
        'Menu bekal sehat 5 hari (Senin-Jumat) yang di-generate otomatis. Minimal 3 hari Ayam per minggu, variasi bumbu dan sayuran.',
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

      for (const [idx, poolRecipe] of [day.protein, day.sayuran].entries()) {
        if (!poolRecipe) continue;

        const category = idx === 0 ? 'protein' : 'sayuran';
        const { rows: recipeRows } = await client.query(
          `INSERT INTO bekal_recipes (day_id, name, description, category, bumbu_dasar_id, estimasi_waktu, kalori_estimasi, tips_bekal, sort_order, source_pool_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [dayId, poolRecipe.name, poolRecipe.description, category, poolRecipe.bumbu_dasar_id, poolRecipe.estimasi_waktu, poolRecipe.kalori_estimasi, poolRecipe.tips_bekal, idx, poolRecipe.id]
        );
        const recipeId = recipeRows[0].id;

        await client.query(
          `INSERT INTO bekal_recipe_ingredients (recipe_id, name, quantity_per_portion, unit, is_bumbu_dasar, sort_order)
           SELECT $1, name, quantity_per_portion, unit, is_bumbu_dasar, sort_order
           FROM bekal_pool_ingredients WHERE pool_recipe_id = $2`,
          [recipeId, poolRecipe.id]
        );

        await client.query(
          `INSERT INTO bekal_recipe_steps (recipe_id, step_number, instruction)
           SELECT $1, step_number, instruction
           FROM bekal_pool_steps WHERE pool_recipe_id = $2`,
          [recipeId, poolRecipe.id]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Auto-generated bekal plan: "${plan.title}" (${plan.status}), start: ${startDate}, ayam: ${chickenCount}/5`);
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
 * Plans run Mon-Fri (5 days), archived after 5 days (Saturday onward).
 * Also triggers auto-generation of next week's plan on Thursday+.
 */
async function syncPlanStatuses() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Archive expired active plans (5-day plans start Monday, expire Saturday)
  await pool.query(`
    UPDATE bekal_plans SET status = 'archived'
    WHERE status = 'active' AND start_date + INTERVAL '5 days' <= $1::date
  `, [today]);

  // 2. Activate upcoming plans whose week has started
  await pool.query(`
    UPDATE bekal_plans SET status = 'active'
    WHERE status = 'upcoming' AND start_date <= $1::date
  `, [today]);

  // 3. Auto-generate next week if needed (Thursday+ trigger)
  const todayDate = new Date(today);
  const dayOfWeek = todayDate.getDay();

  if (dayOfWeek >= 4 || dayOfWeek === 0) {
    const nextMonday = getNextMonday(today);

    const { rows: existing } = await pool.query(
      `SELECT id FROM bekal_plans WHERE start_date = $1 AND status IN ('upcoming', 'active')`,
      [nextMonday]
    );

    if (existing.length === 0) {
      const { rows: poolCheck } = await pool.query('SELECT id FROM bekal_recipe_pool LIMIT 1');
      if (poolCheck.length > 0) {
        // Run generation in the background (fire-and-forget) so we don't block the API response
        generateWeeklyPlan(nextMonday).catch(err => {
          console.error('Background auto-generation failed:', err.message);
        });
      }
    }
  }
}

module.exports = { generateWeeklyPlan, syncPlanStatuses, getNextMonday };
