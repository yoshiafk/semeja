-- Migration 2: Expand meal_plans lifecycle
-- Adds RSVP deadline and extended status states.

-- 2a: Add lifecycle timestamp columns (all nullable, non-breaking)
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS rsvp_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at     TIMESTAMPTZ;

-- 2b: Expand the status CHECK constraint to include new lifecycle values
-- Drop the old constraint first (if it exists), then re-add with new values
ALTER TABLE meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_status_check;

ALTER TABLE meal_plans
  ADD CONSTRAINT meal_plans_status_check
  CHECK (status IN ('draft', 'proposed', 'active', 'shopping', 'closed', 'archived'));

-- 2c: Set NULL statuses to 'active' as a safe default (shouldn't be any, but just in case)
UPDATE meal_plans SET status = 'active' WHERE status IS NULL;
