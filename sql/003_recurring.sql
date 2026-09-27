-- Version 0.0.2: recurring payments.
CREATE TABLE IF NOT EXISTS recurring (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('expense','income')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('RUB','GEL','USD')),
  category VARCHAR(50),
  note VARCHAR(200),
  period VARCHAR(10) NOT NULL CHECK (period IN ('daily','weekly','monthly')),
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring (next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring (user_id, id);
