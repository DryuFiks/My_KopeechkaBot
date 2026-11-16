-- MKB-063: MCP-доступ для ИИ-агентов. Идемпотентно (файл применяется при каждом migrate:up).

-- Откуда операция и её внешний id (например, id транзакции в банке) — защита от дублей.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source VARCHAR(10) NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id VARCHAR(100) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_external
  ON transactions (user_id, external_id) WHERE external_id IS NOT NULL;

-- Секретные ссылки для агентов: хранится только sha256 токена.
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id           SERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  token_hash   CHAR(64) NOT NULL UNIQUE,
  label        VARCHAR(40) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NULL,
  revoked_at   TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_tokens (user_id);

-- Снимки остатка на счетах для сверки с расчётным балансом (бот сам ничего не корректирует).
CREATE TABLE IF NOT EXISTS account_balances (
  id          SERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  account     VARCHAR(50) NOT NULL,
  amount      NUMERIC(14,2) NOT NULL,
  currency    VARCHAR(3) NOT NULL CHECK (currency IN ('RUB', 'GEL', 'USD')),
  amount_gel  NUMERIC(14,2) NULL,
  as_of       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_balances_user ON account_balances (user_id, account, as_of DESC);
