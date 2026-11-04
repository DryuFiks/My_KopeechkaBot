-- MKB-058: недельный дайджест по воскресеньям в 19:00 по поясу пользователя. По умолчанию ВЫКЛЮЧЕН.
-- digest_notified — день последней отправки, чтобы не прислать дважды. Идемпотентно.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS digest_notified DATE NULL;
