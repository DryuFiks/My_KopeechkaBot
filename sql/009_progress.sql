-- MKB-029: ranks and achievements. Idempotent (safe to re-apply).

-- One row per unlocked achievement; UNIQUE makes re-checking the same rules harmless.
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id      BIGINT NOT NULL,
  code         VARCHAR(40) NOT NULL,
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, code)
);

-- Highest rank ever reached: a rank never goes down, even if data (and thus XP) is later deleted.
CREATE TABLE IF NOT EXISTS user_progress (
  user_id     BIGINT PRIMARY KEY,
  rank_index  SMALLINT NOT NULL DEFAULT 0 CHECK (rank_index >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
