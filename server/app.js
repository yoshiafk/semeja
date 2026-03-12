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

const app = express();

// Trust proxy for Vercel/Rate Limiting
app.set('trust proxy', 1);

// Allow CORS from production frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(compression());
app.use(express.json());

// Vercel edge cache: short TTL for GET, no-store for mutations & sensitive routes
app.use('/api', (req, res, next) => {
  const volatileRoutes = ['/activities', '/meal-plans', '/meals', '/participations', '/summary', '/purchases', '/gifts'];
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
app.use('/api/members', membersRouter);
app.use('/api/ingredients', ingredientsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/recipe-search', recipeSearchRouter);
app.use('/api/meal-plans', mealPlansRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/participations', participationsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/auth', authRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/scraper', scraperRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/gifts', giftsRouter);

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
function ensureDB() {
  if (!dbReady) {
    dbReady = initDB().then(() => seed());
  }
  return dbReady;
}

module.exports = { app, ensureDB };
