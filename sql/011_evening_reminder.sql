-- MKB-057: вечернее напоминание «записать траты?». По умолчанию ВЫКЛЮЧЕНО — пользователь включает сам
-- (настройки бота или мини-приложения). evening_notified — день последнего напоминания по поясу пользователя,
-- чтобы не прислать дважды за вечер (в том числе после перезапуска бота). Идемпотентно.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS remind_evening BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS remind_hour SMALLINT NOT NULL DEFAULT 21
  CHECK (remind_hour BETWEEN 0 AND 23);
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS evening_notified DATE NULL;
