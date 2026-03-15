-- Migration 4: Plan reactions (RSVP voting)
-- Allows members to vote on proposed menus before the plan goes active.
-- After admin locks the plan, 'join' reactions can be auto-converted into participations.

CREATE TABLE IF NOT EXISTS plan_reactions (
  id         SERIAL PRIMARY KEY,
  plan_id    INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  meal_id    INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reaction   VARCHAR(10) NOT NULL CHECK (reaction IN ('join', 'skip', 'unsure')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meal_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_plan ON plan_reactions(plan_id);
CREATE INDEX IF NOT EXISTS idx_reactions_meal ON plan_reactions(meal_id);
