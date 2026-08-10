const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { initDB } = require('./db');
const { seed } = require('./seed');

const membersRouter = require('./routes/members');
const ingredientsRouter = require('./routes/ingredients');
const recipesRouter = require('./routes/recipes');
const recipeSearchRouter = require('./routes/recipe-search');
const mealPlansRouter = require('./routes/meal-plans');
const mealsRouter = require('./routes/meals');
const participationsRouter = require('./routes/participations');
const summaryRouter = require('./routes/summary');
const authRouter = require('./routes/auth');
const purchasesRouter = require('./routes/purchases');
const suppliersRouter = require('./routes/suppliers');
const scraperRouter = require('./routes/scraper');
const activitiesRouter = require('./routes/activities');
const giftsRouter = require('./routes/gifts');
const attachmentsRouter = require('./routes/attachments');
const ocrRouter = require('./routes/ocr');
const mealActualsRouter = require('./routes/meal-actuals');
const mealPreviewRouter = require('./routes/meal-preview');
const paymentsRouter = require('./routes/payments');
const bekalSehatRouter = require('./routes/bekal-sehat');
const tripsRouter = require('./routes/trips');
const { autoArchiveMiddleware } = require('./lib/auto-archive');
const { pool } = require('./db');

const app = express();

// Trust proxy for Vercel/Rate Limiting
app.set('trust proxy', 1);

// Allow CORS
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['*'];
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf('*') !== -1 || allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID']
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Vercel edge cache: short TTL for GET, no-store for mutations & sensitive routes
app.use('/api', (req, res, next) => {
  const volatileRoutes = ['/activities', '/meal-plans', '/meals', '/participations', '/summary', '/purchases', '/gifts', '/payments', '/bekal-sehat'];
  const isVolatile = volatileRoutes.some(route => req.path.startsWith(route));

  if (req.method === 'GET' && !isVolatile) {
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Routes
app.use('/api', autoArchiveMiddleware(pool));
app.use('/api/members', membersRouter);
app.use('/api/ingredients', ingredientsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/recipe-search', recipeSearchRouter);
app.use('/api/meal-plans', mealPlansRouter.router);
app.use('/api/meals', mealsRouter);
app.use('/api/meal-actuals', mealActualsRouter);
app.use('/api/meal-preview', mealPreviewRouter);
app.use('/api/participations', participationsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/auth', authRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/scraper', scraperRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/gifts', giftsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/bekal-sehat', bekalSehatRouter);
app.use('/api/trips', tripsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// DB initialization (idempotent, safe for serverless cold starts)
let dbReady = null;

async function doEnsureDB() {
  let client;
  let lockAcquired = false;
  try {
    client = await pool.connect();
    
    // Fast-path check
    const checkFastPath = async () => {
      try {
        const { rows } = await client.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'bekal_recipe_pool' AND column_name = 'is_bumbu_free'
        `);
        const { rows: bekalCheck } = await client.query("SELECT 1 FROM bekal_recipe_pool WHERE name = 'Tahu Kecap Manis'");
        const { rows: ikanCheck } = await client.query("SELECT 1 FROM bekal_recipe_pool WHERE name ILIKE '%ikan%' OR name ILIKE '%nangka%' LIMIT 1");
        const { rows: tripCheck } = await client.query("SELECT 1 FROM trips WHERE slug = 'semarang-jogja-2026'");
        const { rows: partCheck } = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'trip_participations'");
        return rows.length > 0 && bekalCheck.length > 0 && ikanCheck.length === 0 && tripCheck.length > 0 && partCheck.length > 0;
      } catch (e) {
        return false;
      }
    };

    if (await checkFastPath()) return;

    // Fast path failed, try to acquire distributed lock (key: 12345) to prevent concurrent lambda seeds
    const { rows: lockRows } = await client.query('SELECT pg_try_advisory_lock(12345) as acquired');
    lockAcquired = lockRows[0].acquired;

    if (!lockAcquired) {
      console.log('Another instance is initializing the DB. Waiting for it to finish...');
      // Wait for up to 10 seconds for the other instance to finish seeding
      for (let i = 0; i < 10; i++) {
        await new Promise(res => setTimeout(res, 1000));
        if (await checkFastPath()) {
          console.log('DB initialized by another instance.');
          return;
        }
      }
      throw new Error('Database initialization lock timeout. Another process took too long.');
    }

    // Full heavy init (fallback)
    console.log('Running full DB initialization and seed...');
    await initDB();
    await seed();

  } catch (e) {
    console.error('ensureDB failed:', e.message);
    throw e;
  } finally {
    if (client) {
      if (lockAcquired) await client.query('SELECT pg_advisory_unlock(12345)');
      client.release();
    }
  }
}

function ensureDB() {
  if (!dbReady) {
    dbReady = doEnsureDB();
  }
  return dbReady;
}

module.exports = { app, ensureDB };
