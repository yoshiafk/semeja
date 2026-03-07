const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const { seed } = require('./seed');

const membersRouter = require('./routes/members');
const ingredientsRouter = require('./routes/ingredients');
const recipesRouter = require('./routes/recipes');
const mealPlansRouter = require('./routes/meal-plans');
const mealsRouter = require('./routes/meals');
const participationsRouter = require('./routes/participations');
const summaryRouter = require('./routes/summary');
const authRouter = require('./routes/auth');

const app = express();

// Allow CORS from production frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Routes
app.use('/api/members', membersRouter);
app.use('/api/ingredients', ingredientsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/meal-plans', mealPlansRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/participations', participationsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/auth', authRouter);

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
