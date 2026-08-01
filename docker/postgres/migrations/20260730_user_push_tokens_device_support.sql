ALTER TABLE user_push_tokens
  ADD COLUMN IF NOT EXISTS install_id TEXT;

ALTER TABLE user_push_tokens
  ADD COLUMN IF NOT EXISTS app_build TEXT NOT NULL DEFAULT '';

UPDATE user_push_tokens
SET install_id = COALESCE(NULLIF(install_id, ''), CONCAT('legacy-', id::text))
WHERE install_id IS NULL OR install_id = '';

ALTER TABLE user_push_tokens
  ALTER COLUMN install_id SET NOT NULL;

ALTER TABLE user_push_tokens
  ALTER COLUMN user_id DROP NOT NULL;

DROP INDEX IF EXISTS user_push_tokens_user_device_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS user_push_tokens_install_device_unique_idx
  ON user_push_tokens (install_id, device_id);

CREATE INDEX IF NOT EXISTS user_push_tokens_install_id_idx
  ON user_push_tokens (install_id);
