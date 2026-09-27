-- Features through 0.0.8. Apply after schema.sql and 002_add_rate_cache.sql.
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, type VARCHAR(10) NOT NULL CHECK(type IN ('expense','income')),
  name VARCHAR(60) NOT NULL, UNIQUE(user_id,type,name)
);
CREATE TABLE IF NOT EXISTS budgets (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, month DATE NOT NULL, category VARCHAR(60) NOT NULL,
  limit_gel NUMERIC(12,2) NOT NULL CHECK(limit_gel > 0), UNIQUE(user_id,month,category)
);
CREATE TABLE IF NOT EXISTS recurring_payments (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, title VARCHAR(120) NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  currency VARCHAR(3) NOT NULL CHECK(currency IN ('RUB','GEL','USD')), category VARCHAR(60), due_day SMALLINT NOT NULL CHECK(due_day BETWEEN 1 AND 31),
  active BOOLEAN NOT NULL DEFAULT TRUE, last_notified DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS savings_goals (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, title VARCHAR(120) NOT NULL, target_gel NUMERIC(12,2) NOT NULL CHECK(target_gel > 0),
  saved_gel NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(saved_gel >= 0), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budget_user_month ON budgets(user_id,month);
CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_payments(active,due_day);
CREATE INDEX IF NOT EXISTS idx_goals_user ON savings_goals(user_id,active);
