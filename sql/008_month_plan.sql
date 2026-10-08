-- MKB-026: month plan (income sources, mandatory expenses), exchanger factor, onboarding flag.
-- Idempotent: safe to re-apply (see CLAUDE.md "Database / migrations").

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS exchange_factor NUMERIC(4,3) NOT NULL DEFAULT 0.900
    CHECK (exchange_factor >= 0.5 AND exchange_factor <= 1.0);
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ NULL;

-- mode: fixed = `amount` every month; range = average of min_amount/max_amount;
-- actual = the user marks what they actually received each month (income_receipts).
CREATE TABLE IF NOT EXISTS income_sources (
  id          SERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  name        VARCHAR(60) NOT NULL,
  mode        VARCHAR(10) NOT NULL CHECK (mode IN ('fixed', 'range', 'actual')),
  amount      NUMERIC(12,2) NULL CHECK (amount IS NULL OR amount >= 0),
  min_amount  NUMERIC(12,2) NULL CHECK (min_amount IS NULL OR min_amount >= 0),
  max_amount  NUMERIC(12,2) NULL CHECK (max_amount IS NULL OR max_amount >= 0),
  currency    VARCHAR(3) NOT NULL CHECK (currency IN ('RUB', 'GEL', 'USD')),
  pay_day     SMALLINT NULL CHECK (pay_day IS NULL OR pay_day BETWEEN 1 AND 31),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_income_sources_user ON income_sources (user_id);

-- One receipt per source per month (re-marking the same month replaces the amount).
CREATE TABLE IF NOT EXISTS income_receipts (
  id         SERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  source_id  INTEGER NOT NULL REFERENCES income_sources (id) ON DELETE CASCADE,
  month      DATE NOT NULL,
  amount     NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  UNIQUE (source_id, month)
);
CREATE INDEX IF NOT EXISTS idx_income_receipts_user_month ON income_receipts (user_id, month);

CREATE TABLE IF NOT EXISTS planned_expenses (
  id          SERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  name        VARCHAR(60) NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency    VARCHAR(3) NOT NULL CHECK (currency IN ('RUB', 'GEL', 'USD')),
  due_day     SMALLINT NULL CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planned_expenses_user ON planned_expenses (user_id);
