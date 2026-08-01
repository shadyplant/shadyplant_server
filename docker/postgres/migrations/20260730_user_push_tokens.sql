CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android'
    CHECK (platform IN ('android', 'ios', 'web')),
  device_id TEXT NOT NULL DEFAULT '',
  device_name TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_push_tokens_user_device_unique_idx
  ON user_push_tokens (user_id, device_id);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_id_idx
  ON user_push_tokens (user_id);

CREATE INDEX IF NOT EXISTS user_push_tokens_active_idx
  ON user_push_tokens (is_active, last_seen_at DESC);
