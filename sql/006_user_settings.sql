-- MKB-013: per-user display preferences. A row is created lazily (only once a user
-- actually changes a setting via /settings) — until then the app uses defaults in code,
-- so this table starts empty and that's expected, not a bug.
-- Run this after sql/005_savings_goal_target_date.sql.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id           BIGINT PRIMARY KEY,
  display_currency  VARCHAR(3) NOT NULL DEFAULT 'GEL' CHECK (display_currency IN ('RUB', 'GEL', 'USD')),
  timezone          VARCHAR(64) NOT NULL DEFAULT 'Asia/Tbilisi',
  notify_payments   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
