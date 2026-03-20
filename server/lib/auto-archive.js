const { reconcilePlanCosts } = require('../routes/meal-plans');

let lastRun = 0;
const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Automatically archives expired meal plans, activities, and gifts.
 * Rules:
 * - Meal Plans: week_end + 1 day has passed -> 'archived'
 * - Activities: date has passed -> 'archived'
 * - Gifts: event_date has passed -> 'completed' (only if date is set)
 */
async function archiveExpired(pool) {
  const now = Date.now();
  if (now - lastRun < THROTTLE_MS) return;
  lastRun = now;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Meal Plans
    // Archive any plan where (week_end + 1 day) < current date
    const { rows: expiredPlans } = await client.query(`
      SELECT id FROM meal_plans 
      WHERE status NOT IN ('archived') 
      AND (week_end::date + interval '1 day') < NOW()
    `);

    for (const plan of expiredPlans) {
      console.log(`[auto-archive] Archiving meal plan ${plan.id}`);
      await client.query(
        "UPDATE meal_plans SET status = 'archived' WHERE id = $1", 
        [plan.id]
      );
      try {
        await reconcilePlanCosts(client, plan.id);
      } catch (err) {
        console.error(`[auto-archive] Failed to reconcile plan ${plan.id}:`, err);
      }
    }

    // 2. Activities
    const { rowCount: activityCount } = await client.query(`
      UPDATE activities 
      SET status = 'archived'
      WHERE status != 'archived' 
      AND date < CURRENT_DATE
    `);
    if (activityCount > 0) {
      console.log(`[auto-archive] Archived ${activityCount} expired activities`);
    }

    // 3. Gifts
    const { rowCount: giftCount } = await client.query(`
      UPDATE gifts 
      SET status = 'completed'
      WHERE status NOT IN ('archived', 'completed') 
      AND event_date IS NOT NULL 
      AND event_date < CURRENT_DATE
    `);
    if (giftCount > 0) {
      console.log(`[auto-archive] Completed ${giftCount} expired gifts`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[auto-archive] Error during archival:', err);
  } finally {
    client.release();
  }
}

/**
 * Express middleware to trigger auto-archival
 */
const autoArchiveMiddleware = (pool) => async (req, res, next) => {
  // Run it as a "fire and forget" if possible, or wait a bit. 
  // On serverless, we must wait or it might get killed.
  // We'll run it before next() but it's throttled so most of the time it returns instantly.
  try {
    await archiveExpired(pool);
  } catch (err) {
    console.error('[auto-archive-mw] Error:', err);
  }
  next();
};

module.exports = { archiveExpired, autoArchiveMiddleware };
