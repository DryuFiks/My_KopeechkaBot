-- Sprint 2 / V1 — persisted cache for exchange rates, so a bot restart
-- doesn't lose the last known rate (used as a fallback if the API is down).
-- Run this AFTER sql/schema.sql.

CREATE TABLE IF NOT EXISTS rate_cache (
    currency     VARCHAR(3) PRIMARY KEY,
    rate_to_gel  NUMERIC(14,6) NOT NULL,
    fetched_at   TIMESTAMPTZ NOT NULL
);
