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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/members', membersRouter);
app.use('/api/ingredients', ingredientsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/meal-plans', mealPlansRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/participations', participationsRouter);
app.use('/api/summary', summaryRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

async function start() {
  try {
    await initDB();
    await seed();
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
