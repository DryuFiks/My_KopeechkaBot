-- MKB-047: журнал действий для метрик удержания (активные за день/неделю, бот или WebApp).
-- Только факт действия — без сумм, категорий и текстов. Стирается вместе с данными пользователя.
-- Идемпотентно: применяется повторно при каждом migrate:up.

CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  name        VARCHAR(32) NOT NULL,
  source      VARCHAR(8) NOT NULL CHECK (source IN ('bot', 'webapp')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_created ON events (user_id, created_at);
