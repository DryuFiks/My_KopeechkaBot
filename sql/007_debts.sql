-- MKB-021: debts tracked in the WebApp (avalanche/snowball ordering). Idempotent.
CREATE TABLE IF NOT EXISTS debts (
  id               SERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL,
  name             VARCHAR(60) NOT NULL,
  balance_gel      NUMERIC(12,2) NOT NULL CHECK (balance_gel >= 0),
  rate_percent     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (rate_percent >= 0),
  min_payment_gel  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_payment_gel >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts (user_id);
