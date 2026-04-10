-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Inflow History — append-only audit log for monthly inflow changes
-- Date: 2026-04-10
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inflow_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_id     UUID        NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  amount       DECIMAL(12,2) NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: users can only read/write their own rows
ALTER TABLE inflow_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_inflow_history"
  ON inflow_history FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookup by month
CREATE INDEX IF NOT EXISTS idx_inflow_history_month ON inflow_history(month_id, recorded_at DESC);
