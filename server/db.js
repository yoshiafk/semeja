const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://mealplan:mealplan123@localhost:5432/mealplan',
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        role VARCHAR(20) DEFAULT 'member'
      );

      CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        unit VARCHAR(30) NOT NULL,
        price_per_unit INTEGER NOT NULL,
        category VARCHAR(50) DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        description VARCHAR(500) DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
        quantity_per_person DECIMAL(10,3) NOT NULL,
        UNIQUE(recipe_id, ingredient_id)
      );

      CREATE TABLE IF NOT EXISTS meal_plans (
        id SERIAL PRIMARY KEY,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS meals (
        id SERIAL PRIMARY KEY,
        meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        day_name VARCHAR(20) NOT NULL,
        lunch_menu VARCHAR(200) DEFAULT '',
        lunch_recipe_id INTEGER REFERENCES recipes(id),
        dinner_menu VARCHAR(200) DEFAULT '',
        dinner_recipe_id INTEGER REFERENCES recipes(id),
        UNIQUE(meal_plan_id, date)
      );

      CREATE TABLE IF NOT EXISTS meal_ingredients (
        id SERIAL PRIMARY KEY,
        meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
        quantity_per_person DECIMAL(10,3) NOT NULL,
        meal_type VARCHAR(10) NOT NULL,
        UNIQUE(meal_id, ingredient_id, meal_type)
      );

      CREATE TABLE IF NOT EXISTS participations (
        id SERIAL PRIMARY KEY,
        meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(meal_id, member_id)
      );
    `);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
