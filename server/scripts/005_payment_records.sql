-- Migration 5: Payment records
-- Tracks who has paid their weekly share.
-- This is a confirmation ledger only — no payment processing involved.

CREATE TABLE IF NOT EXISTS payment_records (
  id           SERIAL PRIMARY KEY,
  meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  paid_at      TIMESTAMPTZ,
  confirmed_by INTEGER REFERENCES members(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meal_plan_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_plan ON payment_records(meal_plan_id);
