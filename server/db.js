const { Pool } = require('pg');

const isServerless = !!process.env.VERCEL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://mealplan:mealplan123@localhost:5432/mealplan',
  ssl: isServerless ? { rejectUnauthorized: false } : false,
  max: isServerless ? 5 : 10,
  idleTimeoutMillis: isServerless ? 15_000 : 30_000,
  connectionTimeoutMillis: isServerless ? 30_000 : 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

async function initDB(retries = 3) {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    if (retries > 0) {
      console.warn(`Connection failed, retrying in 5s... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return initDB(retries - 1);
    }
    throw err;
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        size_bytes INTEGER NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

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
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings INTEGER DEFAULT 1;
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_normalized BOOLEAN DEFAULT false;

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
        -- Legacy columns, will be dropped after migration to meal_menu_items
        main_course_menu VARCHAR(200) DEFAULT '',
        main_course_recipe_id INTEGER REFERENCES recipes(id),
        second_course_menu VARCHAR(200) DEFAULT '',
        second_course_recipe_id INTEGER REFERENCES recipes(id),
        dessert_menu VARCHAR(200) DEFAULT '',
        dessert_recipe_id INTEGER REFERENCES recipes(id),
        UNIQUE(meal_plan_id, date)
      );

      -- Ensure meals has menu categories
      ALTER TABLE meals ADD COLUMN IF NOT EXISTS requires_rice BOOLEAN DEFAULT FALSE;

      ALTER TABLE meals ADD COLUMN IF NOT EXISTS requires_rice BOOLEAN DEFAULT false;
      
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
        unit VARCHAR(50),
        meal_type VARCHAR(10) NOT NULL,
        UNIQUE(meal_id, ingredient_id, meal_type)
      );
      
      CREATE TABLE IF NOT EXISTS meal_menu_items (
        id SERIAL PRIMARY KEY,
        meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
        custom_name VARCHAR(200),
        category VARCHAR(20) NOT NULL, -- 'main', 'second', 'dessert'
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Migration: Move existing meal columns to meal_menu_items if table was empty
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meals' AND column_name = 'main_course_recipe_id') THEN
          IF NOT EXISTS (SELECT 1 FROM meal_menu_items LIMIT 1) THEN
            -- Migrate Main Course
            EXECUTE 'INSERT INTO meal_menu_items (meal_id, recipe_id, custom_name, category, sort_order)
            SELECT id, main_course_recipe_id, main_course_menu, ''main'', 0
            FROM meals 
            WHERE main_course_menu != '''' OR main_course_recipe_id IS NOT NULL';

            -- Migrate Second Course
            EXECUTE 'INSERT INTO meal_menu_items (meal_id, recipe_id, custom_name, category, sort_order)
            SELECT id, second_course_recipe_id, second_course_menu, ''second'', 0
            FROM meals 
            WHERE second_course_menu != '''' OR second_course_recipe_id IS NOT NULL';

            -- Migrate Dessert
            EXECUTE 'INSERT INTO meal_menu_items (meal_id, recipe_id, custom_name, category, sort_order)
            SELECT id, dessert_recipe_id, dessert_menu, ''dessert'', 0
            FROM meals 
            WHERE dessert_menu != '''' OR dessert_recipe_id IS NOT NULL';
          END IF;
        END IF;
      END $$;

      -- DROP legacy menu columns if they exist (migrated to meal_menu_items)
      ALTER TABLE meals DROP COLUMN IF EXISTS main_course_menu;
      ALTER TABLE meals DROP COLUMN IF EXISTS second_course_menu;
      ALTER TABLE meals DROP COLUMN IF EXISTS dessert_menu;
      ALTER TABLE meals DROP COLUMN IF EXISTS main_course_recipe_id;
      ALTER TABLE meals DROP COLUMN IF EXISTS second_course_recipe_id;
      ALTER TABLE meals DROP COLUMN IF EXISTS dessert_recipe_id;
      
      ALTER TABLE meals DROP COLUMN IF EXISTS lunch_menu;
      ALTER TABLE meals DROP COLUMN IF EXISTS lunch_recipe_id;
      ALTER TABLE meals DROP COLUMN IF EXISTS dinner_menu;
      ALTER TABLE meals DROP COLUMN IF EXISTS dinner_recipe_id;

      CREATE TABLE IF NOT EXISTS participations (
        id SERIAL PRIMARY KEY,
        meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(meal_id, member_id)
      );

      ALTER TABLE members ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
      ALTER TABLE members ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45);
      ALTER TABLE members ADD COLUMN IF NOT EXISTS last_user_agent TEXT;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS last_location VARCHAR(100);
      DROP INDEX IF EXISTS idx_members_name_unique; -- Drop old unique if exists
      
      -- We will use a functional index for case-insensitive uniqueness
      -- Wrap in a block to handle existing duplicates gracefully with a clear message
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_members_name_lower') THEN
          CREATE UNIQUE INDEX idx_members_name_lower ON members (LOWER(name));
        END IF;
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Caught duplicate members. Please run server/scripts/merge_duplicate_members.js';
      END $$;

      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS stock_quantity DECIMAL(10,3) DEFAULT 0;
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS min_stock_threshold DECIMAL(10,3) DEFAULT 0;
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS last_restocked TIMESTAMP;
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS price_last_updated_at TIMESTAMP;
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(150);

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
        meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL,
        member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE SET NULL;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS receipt_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS purchase_assignments (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
        meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(purchase_id, meal_id)
      );

      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        date DATE NOT NULL,
        time TIME NOT NULL,
        location VARCHAR(300) DEFAULT '',
        cost_type VARCHAR(20) DEFAULT 'free',
        cost_amount INTEGER DEFAULT 0,
        max_participants INTEGER,
        created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'upcoming',
        receipt_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE activities ADD COLUMN IF NOT EXISTS receipt_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL;
      ALTER TABLE activities ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'upcoming';
      CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);

      CREATE TABLE IF NOT EXISTS activity_items (
        id SERIAL PRIMARY KEY,
        activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        quantity DECIMAL(10,3) DEFAULT 1,
        price INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_participations (
        id SERIAL PRIMARY KEY,
        activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        guests_count INTEGER DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'unpaid',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(activity_id, member_id)
      );

      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        event_date DATE,
        status VARCHAR(20) DEFAULT 'planning', -- planning, active, completed, cancelled
        created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS gift_items (
        id SERIAL PRIMARY KEY,
        gift_id INTEGER REFERENCES gifts(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        estimated_price INTEGER DEFAULT 0,
        actual_price INTEGER DEFAULT 0,
        url TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'needed', -- needed, bought
        receipt_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS gift_participants (
        id SERIAL PRIMARY KEY,
        gift_id INTEGER REFERENCES gifts(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        contribution_amount INTEGER DEFAULT 0,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(gift_id, member_id)
      );

      ALTER TABLE gift_items ADD COLUMN IF NOT EXISTS receipt_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS plan_reactions (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES meal_plans(id) ON DELETE CASCADE,
        meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        reaction VARCHAR(20) NOT NULL, -- join, skip, unsure
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(meal_id, member_id)
      );

      CREATE TABLE IF NOT EXISTS plan_member_settlements (
        id SERIAL PRIMARY KEY,
        meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        days_joined INTEGER DEFAULT 0,
        estimated_cost INTEGER DEFAULT 0,
        actual_cost INTEGER DEFAULT 0,
        settled_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(meal_plan_id, member_id)
      );

      CREATE TABLE IF NOT EXISTS payment_records (
        id SERIAL PRIMARY KEY,
        meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        paid_at TIMESTAMP DEFAULT NOW(),
        confirmed_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
        notes TEXT,
        UNIQUE(meal_plan_id, member_id)
      );

      ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS confirmed_by INTEGER REFERENCES members(id) ON DELETE SET NULL;
      ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS notes TEXT;

      -- ── Bekal Sehat Module ──────────────────────────────────────────

      -- Bumbu Dasar library (merah, putih, kuning)
      CREATE TABLE IF NOT EXISTS bekal_bumbu_dasar (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        color VARCHAR(20) NOT NULL, -- 'merah', 'putih', 'kuning'
        description TEXT DEFAULT '',
        cara_membuat TEXT DEFAULT '',
        tips_penyimpanan TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bekal_bumbu_ingredients (
        id SERIAL PRIMARY KEY,
        bumbu_id INTEGER REFERENCES bekal_bumbu_dasar(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        quantity_per_portion DECIMAL(10,3) NOT NULL,
        unit VARCHAR(30) NOT NULL,
        sort_order INTEGER DEFAULT 0
      );

      -- Weekly bekal plans (created by admin)
      CREATE TABLE IF NOT EXISTS bekal_plans (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        start_date DATE NOT NULL,
        week_label VARCHAR(50) NOT NULL, -- e.g. 'Minggu 1 - Juni 2026'
        status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived'
        created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- 7 days per plan
      CREATE TABLE IF NOT EXISTS bekal_days (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES bekal_plans(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL, -- 1-7
        day_name VARCHAR(20) NOT NULL, -- Senin, Selasa, etc.
        UNIQUE(plan_id, day_number)
      );

      -- Recipes attached to a day (2 per day: protein + sayuran)
      CREATE TABLE IF NOT EXISTS bekal_recipes (
        id SERIAL PRIMARY KEY,
        day_id INTEGER REFERENCES bekal_days(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        category VARCHAR(20) NOT NULL, -- 'protein' or 'sayuran'
        bumbu_dasar_id INTEGER REFERENCES bekal_bumbu_dasar(id) ON DELETE SET NULL,
        estimasi_waktu INTEGER DEFAULT 30, -- minutes
        kalori_estimasi INTEGER DEFAULT 0, -- kcal per portion
        tips_bekal TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bekal_recipe_ingredients (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES bekal_recipes(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        quantity_per_portion DECIMAL(10,3) NOT NULL,
        unit VARCHAR(30) NOT NULL,
        is_bumbu_dasar BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bekal_recipe_steps (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES bekal_recipes(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        UNIQUE(recipe_id, step_number)
      );

      -- ── Bekal Recipe Pool (template library for auto-generation) ─────

      CREATE TABLE IF NOT EXISTS bekal_recipe_pool (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        category VARCHAR(20) NOT NULL,        -- 'protein' or 'sayuran'
        bumbu_dasar_id INTEGER REFERENCES bekal_bumbu_dasar(id),
        estimasi_waktu INTEGER DEFAULT 30,
        kalori_estimasi INTEGER DEFAULT 0,
        tips_bekal TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bekal_pool_ingredients (
        id SERIAL PRIMARY KEY,
        pool_recipe_id INTEGER REFERENCES bekal_recipe_pool(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        quantity_per_portion DECIMAL(10,3) NOT NULL,
        unit VARCHAR(30) NOT NULL,
        is_bumbu_dasar BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bekal_pool_steps (
        id SERIAL PRIMARY KEY,
        pool_recipe_id INTEGER REFERENCES bekal_recipe_pool(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        UNIQUE(pool_recipe_id, step_number)
      );

      -- Link generated recipes back to pool templates for anti-repetition tracking
      ALTER TABLE bekal_recipes ADD COLUMN IF NOT EXISTS source_pool_id
        INTEGER REFERENCES bekal_recipe_pool(id) ON DELETE SET NULL;

      -- Member participation (join with portion count)
      CREATE TABLE IF NOT EXISTS bekal_participations (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES bekal_plans(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        portions INTEGER DEFAULT 1, -- 1-10
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(plan_id, member_id)
      );

      CREATE INDEX IF NOT EXISTS idx_bekal_days_plan ON bekal_days(plan_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_recipes_day ON bekal_recipes(day_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_recipe_ingredients_recipe ON bekal_recipe_ingredients(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_recipe_steps_recipe ON bekal_recipe_steps(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_bumbu_ingredients_bumbu ON bekal_bumbu_ingredients(bumbu_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_participations_plan ON bekal_participations(plan_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_participations_member ON bekal_participations(member_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_plans_start_date ON bekal_plans(start_date);
      CREATE INDEX IF NOT EXISTS idx_bekal_plans_status ON bekal_plans(status);
      CREATE INDEX IF NOT EXISTS idx_bekal_pool_category ON bekal_recipe_pool(category);
      CREATE INDEX IF NOT EXISTS idx_bekal_pool_bumbu ON bekal_recipe_pool(bumbu_dasar_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_recipes_source ON bekal_recipes(source_pool_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_pool_ingredients_recipe ON bekal_pool_ingredients(pool_recipe_id);
      CREATE INDEX IF NOT EXISTS idx_bekal_pool_steps_recipe ON bekal_pool_steps(pool_recipe_id);

      -- Migration: Ensure meal_ingredients has the unit column if it was created before
      ALTER TABLE meal_ingredients ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
      
      -- Migration: Ensure bekal_plans has start_date
      ALTER TABLE bekal_plans ADD COLUMN IF NOT EXISTS start_date DATE;

      -- Migration: Add protein_type and is_bumbu_free to recipe pool for smarter generation
      ALTER TABLE bekal_recipe_pool ADD COLUMN IF NOT EXISTS protein_type VARCHAR(20) DEFAULT NULL;
      ALTER TABLE bekal_recipe_pool ADD COLUMN IF NOT EXISTS is_bumbu_free BOOLEAN DEFAULT false;

      -- Performance indexes on foreign keys used in JOINs and WHERE clauses
      CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
      CREATE INDEX IF NOT EXISTS idx_activity_participations_activity_id ON activity_participations(activity_id);
      CREATE INDEX IF NOT EXISTS idx_activity_participations_member_id ON activity_participations(member_id);
      CREATE INDEX IF NOT EXISTS idx_gifts_created_by ON gifts(created_by);
      CREATE INDEX IF NOT EXISTS idx_gift_items_gift_id ON gift_items(gift_id);
      CREATE INDEX IF NOT EXISTS idx_gift_participants_gift_id ON gift_participants(gift_id);
      CREATE INDEX IF NOT EXISTS idx_gift_participants_member_id ON gift_participants(member_id);
      CREATE INDEX IF NOT EXISTS idx_meals_meal_plan_id ON meals(meal_plan_id);
      CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
      CREATE INDEX IF NOT EXISTS idx_participations_meal_id ON participations(meal_id);
      CREATE INDEX IF NOT EXISTS idx_participations_member_id ON participations(member_id);
      CREATE INDEX IF NOT EXISTS idx_meal_ingredients_meal_id ON meal_ingredients(meal_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_ingredient_id ON purchases(ingredient_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_meal_plan_id ON purchases(meal_plan_id);
      
      CREATE INDEX IF NOT EXISTS idx_reactions_plan ON plan_reactions(plan_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_meal ON plan_reactions(meal_id);
      CREATE INDEX IF NOT EXISTS idx_payments_plan ON payment_records(meal_plan_id);

      -- ── Trips Module ─────────────────────────────────────────────────

      CREATE TABLE IF NOT EXISTS trips (
        id                SERIAL PRIMARY KEY,
        slug              VARCHAR(100) NOT NULL UNIQUE,
        title             VARCHAR(200) NOT NULL,
        subtitle          VARCHAR(300) DEFAULT '',
        start_date        DATE NOT NULL,
        end_date          DATE NOT NULL,
        participant_count INTEGER DEFAULT 0,
        transport         TEXT DEFAULT '',
        pace              VARCHAR(100) DEFAULT '',
        status            VARCHAR(20) DEFAULT 'upcoming',
        cover_city        VARCHAR(100) DEFAULT '',
        created_by        INTEGER REFERENCES members(id) ON DELETE SET NULL,
        created_at        TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS trip_participations (
        id         SERIAL PRIMARY KEY,
        trip_id    INTEGER REFERENCES trips(id) ON DELETE CASCADE,
        member_id  INTEGER REFERENCES members(id) ON DELETE CASCADE,
        joined_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(trip_id, member_id)
      );

      CREATE TABLE IF NOT EXISTS trip_hotels (
        id         SERIAL PRIMARY KEY,
        trip_id    INTEGER REFERENCES trips(id) ON DELETE CASCADE,
        name       VARCHAR(200) NOT NULL,
        city       VARCHAR(100) NOT NULL,
        address    TEXT NOT NULL,
        maps_url   TEXT DEFAULT '',
        check_in   DATE NOT NULL,
        check_out  DATE NOT NULL,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS trip_hotel_distances (
        id          SERIAL PRIMARY KEY,
        hotel_id    INTEGER REFERENCES trip_hotels(id) ON DELETE CASCADE,
        destination VARCHAR(200) NOT NULL,
        distance_km VARCHAR(20) NOT NULL,
        duration    VARCHAR(50) NOT NULL,
        sort_order  INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS trip_days (
        id           SERIAL PRIMARY KEY,
        trip_id      INTEGER REFERENCES trips(id) ON DELETE CASCADE,
        day_number   INTEGER NOT NULL,
        date         DATE NOT NULL,
        label        VARCHAR(100) NOT NULL,
        city         VARCHAR(50) NOT NULL,
        area_note    TEXT DEFAULT '',
        warning_note TEXT DEFAULT '',
        UNIQUE(trip_id, day_number)
      );

      CREATE TABLE IF NOT EXISTS trip_schedule_items (
        id               SERIAL PRIMARY KEY,
        day_id           INTEGER REFERENCES trip_days(id) ON DELETE CASCADE,
        time_start       VARCHAR(10) NOT NULL,
        time_end         VARCHAR(10) DEFAULT '',
        name             VARCHAR(300) NOT NULL,
        activity_type    VARCHAR(30) NOT NULL,
        location         TEXT DEFAULT '',
        area             VARCHAR(200) DEFAULT '',
        maps_url         TEXT DEFAULT '',
        notes            TEXT DEFAULT '',
        opening_hours    VARCHAR(200) DEFAULT '',
        is_highlight     BOOLEAN DEFAULT false,
        is_cash_only     BOOLEAN DEFAULT false,
        requires_booking BOOLEAN DEFAULT false,
        is_optional      BOOLEAN DEFAULT false,
        sort_order       INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS trip_budget_rows (
        id               SERIAL PRIMARY KEY,
        trip_id          INTEGER REFERENCES trips(id) ON DELETE CASCADE,
        category         VARCHAR(200) NOT NULL,
        detail           VARCHAR(300) DEFAULT '',
        amount_rp        INTEGER DEFAULT 0,
        is_accommodation BOOLEAN DEFAULT false,
        is_total_row     BOOLEAN DEFAULT false,
        sort_order       INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS trip_packing_items (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
        category VARCHAR(50) DEFAULT 'Pribadi',
        item_name VARCHAR(255) NOT NULL,
        is_checked BOOLEAN DEFAULT false,
        assignee_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_trips_slug ON trips(slug);
      CREATE INDEX IF NOT EXISTS idx_trip_days_trip ON trip_days(trip_id);
      CREATE INDEX IF NOT EXISTS idx_trip_schedule_day ON trip_schedule_items(day_id);
      CREATE INDEX IF NOT EXISTS idx_trip_hotels_trip ON trip_hotels(trip_id);
      CREATE INDEX IF NOT EXISTS idx_trip_hotel_distances_hotel ON trip_hotel_distances(hotel_id);
      CREATE INDEX IF NOT EXISTS idx_trip_budget_trip ON trip_budget_rows(trip_id);

      -- Migration: Added columns for Trip CRUD features
      ALTER TABLE trip_schedule_items ADD COLUMN IF NOT EXISTS is_done BOOLEAN DEFAULT false;
      ALTER TABLE trip_budget_rows ADD COLUMN IF NOT EXISTS actual_amount_rp INTEGER DEFAULT 0;
    `);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
