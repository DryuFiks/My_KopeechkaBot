-- MKB-012: an optional target date for a savings goal, so progress can show
-- "on track" / "overdue" instead of just a saved/target ratio.
-- Run this after sql/004_categories_rules.sql.

ALTER TABLE savings_goals
  ADD COLUMN IF NOT EXISTS target_date DATE;
