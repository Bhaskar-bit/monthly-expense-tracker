-- Migration: security_hardening
-- Enables Row Level Security on all user-data tables, creates an immutable
-- audit log, a serverless-safe rate-limit counter table, and the
-- increment_rate_limit() RPC used by the API layer.

-- ── RLS on every user-data table ─────────────────────────────────────────────
ALTER TABLE months              ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_returns  ENABLE ROW LEVEL SECURITY;

-- Drop any stale rls_ policies first (makes this migration idempotent)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
             AND policyname LIKE 'rls_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Each table: every authenticated user can only see / modify their own rows
CREATE POLICY rls_months_all   ON months            FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY rls_expenses_all ON expenses           FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY rls_goals_all    ON savings_goals      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY rls_contrib_all  ON goal_contributions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY rls_recur_all    ON recurring_expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY rls_returns_all  ON investment_returns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Audit log ─────────────────────────────────────────────────────────────────
-- Immutable record of financial mutations. Only SECURITY DEFINER functions
-- (server-side) can INSERT. Users can only SELECT their own rows.
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        text        NOT NULL,   -- 'expense.create' | 'expense.delete' | 'goal.delete' …
  resource_type text        NOT NULL,   -- 'expense' | 'month' | 'savings_goal' | 'recurring_expense'
  resource_id   uuid,
  metadata      jsonb,
  ip_address    text,
  created_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Users can read their own audit history; only server writes it
CREATE POLICY rls_audit_select ON audit_logs FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs(user_id, created_at DESC);

-- ── Rate limit counters (serverless-safe, user-scoped) ────────────────────────
-- Persisted in Postgres so counters survive across serverless function instances.
-- Rows are automatically purged by increment_rate_limit() on each call.
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key         text        NOT NULL,
  window_end  timestamptz NOT NULL,
  count       integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_end)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limit_counters(window_end);

ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- No user-facing policy — only SECURITY DEFINER RPC can access this table

-- ── increment_rate_limit RPC ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key            text,
  p_window_seconds int,
  p_max            int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_end timestamptz := date_trunc('second', now())
                              + (p_window_seconds || ' seconds')::interval;
  v_count int;
BEGIN
  -- Clean up expired windows (keep table lean)
  DELETE FROM rate_limit_counters WHERE window_end < now();

  -- Upsert counter for the current window
  INSERT INTO rate_limit_counters(key, window_end, count)
    VALUES (p_key, v_window_end, 1)
    ON CONFLICT (key, window_end)
    DO UPDATE SET count = rate_limit_counters.count + 1
    RETURNING count INTO v_count;

  RETURN jsonb_build_object('count', v_count, 'window_end', v_window_end);
END;
$$;
