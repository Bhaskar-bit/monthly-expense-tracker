-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Budget Rules Engine + Bank Statement Import staging tables
-- Date: 2026-04-05
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Budget Rules ───────────────────────────────────────────────────────────
-- User-defined conditional rules that fire alerts when spending thresholds
-- are breached. rule_type options:
--   "threshold"  – absolute amount (e.g. Food Apps > ₹3000/month)
--   "percentage" – % of inflow    (e.g. total Spent > 80% of inflow)
--   "velocity"   – daily spending spike (e.g. Cab > ₹500 in one day)

CREATE TABLE IF NOT EXISTS budget_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  rule_type           TEXT NOT NULL CHECK (rule_type IN ('threshold', 'percentage', 'velocity')),
  is_active           BOOLEAN NOT NULL DEFAULT true,

  -- Condition
  condition_category  TEXT,               -- NULL means all categories combined
  condition_operator  TEXT NOT NULL CHECK (condition_operator IN ('gt', 'gte', 'lt', 'lte')),
  condition_value     DECIMAL(10,2) NOT NULL CHECK (condition_value > 0),
  condition_period    TEXT NOT NULL CHECK (condition_period IN ('daily', 'weekly', 'monthly')),
  condition_unit      TEXT NOT NULL CHECK (condition_unit IN ('amount', 'pct_of_inflow')),

  -- Action (alerts only)
  action_severity     TEXT NOT NULL DEFAULT 'warning' CHECK (action_severity IN ('info', 'warning', 'critical')),
  action_message      TEXT,               -- optional custom alert message

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Budget Rule Triggers ───────────────────────────────────────────────────
-- Immutable log of every time a rule fired. Prevents duplicate alerts
-- within the same period and provides audit history.

CREATE TABLE IF NOT EXISTS budget_rule_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES budget_rules(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year      DATE NOT NULL,          -- fiscal month this trigger belongs to
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_data    JSONB,                  -- { category, current_amount, threshold, pct }
  is_acknowledged BOOLEAN NOT NULL DEFAULT false
);

-- ── 3. Import Sessions ────────────────────────────────────────────────────────
-- Tracks each bank statement import attempt. Staging area before user confirms.

CREATE TABLE IF NOT EXISTS import_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL CHECK (source_type IN ('csv', 'xlsx', 'pdf', 'image')),
  source_bank     TEXT,                   -- 'HDFC' | 'ICICI' | 'SBI' | ... | 'Generic'
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  raw_count       INT,
  confirmed_count INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Import Transactions ────────────────────────────────────────────────────
-- Individual transactions parsed from the bank statement, awaiting user review.

CREATE TABLE IF NOT EXISTS import_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Raw parsed fields (from bank statement)
  raw_description     TEXT,
  raw_amount          DECIMAL(10,2) NOT NULL,
  raw_date            DATE NOT NULL,
  raw_type            TEXT CHECK (raw_type IN ('debit', 'credit')),

  -- AI categorisation
  ai_category         TEXT,
  ai_confidence       DECIMAL(3,2) CHECK (ai_confidence BETWEEN 0 AND 1),

  -- User overrides (set in review step)
  user_category       TEXT,
  user_description    TEXT,
  expense_source      TEXT NOT NULL DEFAULT 'savings_account'
                        CHECK (expense_source IN ('savings_account', 'credit_card')),

  -- Review state
  is_duplicate        BOOLEAN NOT NULL DEFAULT false,
  is_selected         BOOLEAN NOT NULL DEFAULT true,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE budget_rules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_rule_triggers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_transactions    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_budget_rules"
  ON budget_rules FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_rule_triggers"
  ON budget_rule_triggers FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_import_sessions"
  ON import_sessions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_import_transactions"
  ON import_transactions FOR ALL USING (auth.uid() = user_id);

-- ── 6. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_budget_rules_user        ON budget_rules(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rule_triggers_rule_month ON budget_rule_triggers(rule_id, month_year);
CREATE INDEX IF NOT EXISTS idx_rule_triggers_user_unack ON budget_rule_triggers(user_id) WHERE is_acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_import_sessions_user     ON import_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_txns_session      ON import_transactions(session_id);

-- ── 7. Auto-update updated_at ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_budget_rules_updated_at
  BEFORE UPDATE ON budget_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_sessions_updated_at
  BEFORE UPDATE ON import_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
