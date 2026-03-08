const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://mealplan:mealplan123@localhost:5432/mealplan',
});

// Prevent background pool errors from crashing the process
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        role VARCHAR(20) DEFAULT 'member',
        password_hash VARCHAR(255)
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
        main_course_menu VARCHAR(200) DEFAULT '',
        main_course_recipe_id INTEGER REFERENCES recipes(id),
        second_course_menu VARCHAR(200) DEFAULT '',
        second_course_recipe_id INTEGER REFERENCES recipes(id),
        dessert_menu VARCHAR(200) DEFAULT '',
        dessert_recipe_id INTEGER REFERENCES recipes(id),
        UNIQUE(meal_plan_id, date)
      );

      ALTER TABLE meals ADD COLUMN IF NOT EXISTS main_course_menu VARCHAR(200) DEFAULT '';
      ALTER TABLE meals ADD COLUMN IF NOT EXISTS main_course_recipe_id INTEGER REFERENCES recipes(id);
      ALTER TABLE meals ADD COLUMN IF NOT EXISTS second_course_menu VARCHAR(200) DEFAULT '';
      ALTER TABLE meals ADD COLUMN IF NOT EXISTS second_course_recipe_id INTEGER REFERENCES recipes(id);
      ALTER TABLE meals ADD COLUMN IF NOT EXISTS dessert_menu VARCHAR(200) DEFAULT '';
      ALTER TABLE meals ADD COLUMN IF NOT EXISTS dessert_recipe_id INTEGER REFERENCES recipes(id);

      ALTER TABLE meals DROP COLUMN IF EXISTS lunch_menu;
      ALTER TABLE meals DROP COLUMN IF EXISTS lunch_recipe_id;
      ALTER TABLE meals DROP COLUMN IF EXISTS dinner_menu;
      ALTER TABLE meals DROP COLUMN IF EXISTS dinner_recipe_id;

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

      ALTER TABLE members ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS stock_quantity DECIMAL(10,3) DEFAULT 0;
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS min_stock_threshold DECIMAL(10,3) DEFAULT 0;
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS last_restocked TIMESTAMP;

      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        location VARCHAR(300) DEFAULT '',
        notes VARCHAR(500) DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        quantity DECIMAL(10,3) NOT NULL,
        total_price INTEGER NOT NULL,
        price_per_unit INTEGER GENERATED ALWAYS AS (
          CASE WHEN quantity > 0 THEN ROUND(total_price / quantity) ELSE 0 END
        ) STORED,
        purchased_at DATE DEFAULT CURRENT_DATE,
        notes VARCHAR(300) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
