-- Migration 3: Daily shopping list snapshot
-- Stores the locked shopping list at the moment a plan moves to 'shopping' status.
-- Prevents retroactive recipe changes from affecting what the buyer was told to purchase.

CREATE TABLE IF NOT EXISTS shopping_list_snapshots (
  id                SERIAL PRIMARY KEY,
  meal_plan_id      INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  ingredient_id     INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
  ingredient_name   VARCHAR(255) NOT NULL,
  quantity          NUMERIC(10,3) NOT NULL,
  unit              VARCHAR(50) NOT NULL,
  estimated_cost    INTEGER NOT NULL DEFAULT 0,
  cheapest_supplier VARCHAR(255),
  snapshotted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meal_plan_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_plan ON shopping_list_snapshots(meal_plan_id);
