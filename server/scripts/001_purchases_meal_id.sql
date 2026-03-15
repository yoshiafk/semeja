-- Migration 1: Tag purchases to a specific meal
-- This is the most critical change. Enables daily cost tracking, per-day reconciliation, and accurate cost splitting.

-- 1a: Add meal_id to purchases (nullable, so existing records remain valid)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL;

-- 1b: Index for per-meal lookups (used heavily in summary.js)
CREATE INDEX IF NOT EXISTS idx_purchases_meal_id ON purchases(meal_id);
