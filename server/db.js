const { Pool } = require('pg');

const isServerless = !!process.env.VERCEL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://mealplan:mealplan123@localhost:5432/mealplan',
  // Serverless: fewer connections + aggressive cleanup
  max: isServerless ? 3 : 10,
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
  connectionTimeoutMillis: 5_000,
});

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

      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Lauk';
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_url VARCHAR(500) DEFAULT '';

      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
        quantity_per_person DECIMAL(10,3) NOT NULL,
        UNIQUE(recipe_id, ingredient_id)
      );

      ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS name VARCHAR(150);
      ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS custom_unit VARCHAR(50);
      ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false;

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
      ALTER TABLE meals ADD COLUMN IF NOT EXISTS requires_rice BOOLEAN DEFAULT false;
      UPDATE meals SET requires_rice = false WHERE requires_rice IS true; -- Reset existing state for consistency
      
      -- Migrate day names to Indonesian
      UPDATE meals SET day_name = 'Senin' WHERE day_name = 'Monday';
      UPDATE meals SET day_name = 'Selasa' WHERE day_name = 'Tuesday';
      UPDATE meals SET day_name = 'Rabu' WHERE day_name = 'Wednesday';
      UPDATE meals SET day_name = 'Kamis' WHERE day_name = 'Thursday';
      UPDATE meals SET day_name = 'Jumat' WHERE day_name = 'Friday';
      UPDATE meals SET day_name = 'Sabtu' WHERE day_name = 'Saturday';
      UPDATE meals SET day_name = 'Minggu' WHERE day_name = 'Sunday';

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
        meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE SET NULL,
        quantity DECIMAL(10,3) NOT NULL,
        total_price INTEGER NOT NULL,
        price_per_unit INTEGER GENERATED ALWAYS AS (
          CASE WHEN quantity > 0 THEN ROUND(total_price / quantity) ELSE 0 END
        ) STORED,
        purchased_at DATE DEFAULT CURRENT_DATE,
        notes VARCHAR(300) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE SET NULL;

      -- Performance indexes on foreign keys used in JOINs and WHERE clauses
      CREATE INDEX IF NOT EXISTS idx_meals_meal_plan_id ON meals(meal_plan_id);
      CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
      CREATE INDEX IF NOT EXISTS idx_participations_meal_id ON participations(meal_id);
      CREATE INDEX IF NOT EXISTS idx_participations_member_id ON participations(member_id);
      CREATE INDEX IF NOT EXISTS idx_meal_ingredients_meal_id ON meal_ingredients(meal_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_ingredient_id ON purchases(ingredient_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_meal_plan_id ON purchases(meal_plan_id);
    `);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
