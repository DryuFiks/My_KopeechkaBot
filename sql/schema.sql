-- Kopeechka Bot — MVP schema (Sprint 1 / M2)
-- Run this against the finance_bot database.

CREATE TABLE IF NOT EXISTS transactions (
    id           SERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL,
    type         VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency     VARCHAR(3) NOT NULL CHECK (currency IN ('RUB', 'GEL', 'USD')),
    amount_gel   NUMERIC(12,2) NULL,
    category     VARCHAR(50) NULL,
    note         VARCHAR(200) NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);
