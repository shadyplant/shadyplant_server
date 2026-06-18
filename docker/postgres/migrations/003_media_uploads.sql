CREATE TABLE IF NOT EXISTS media_uploads (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_staff_account_id UUID REFERENCES staff_accounts(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  slot_key TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL,
  original_file_name TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  byte_size INTEGER NOT NULL DEFAULT 0,
  s3_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploaded', 'failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  uploaded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS media_uploads_s3_key_unique_idx
  ON media_uploads (s3_key);

CREATE INDEX IF NOT EXISTS media_uploads_org_created_idx
  ON media_uploads (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_uploads_org_entity_idx
  ON media_uploads (organization_id, entity_type, entity_id, slot_key, created_at DESC);
