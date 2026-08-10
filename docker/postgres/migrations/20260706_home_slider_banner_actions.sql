CREATE TABLE IF NOT EXISTS home_slider_banners (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  title TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '/search',
  desktop_image TEXT NOT NULL DEFAULT '',
  mobile_image TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS home_slider_banners_org_key_unique_idx
  ON home_slider_banners (organization_id, LOWER(item_key));

CREATE INDEX IF NOT EXISTS home_slider_banners_org_active_sort_idx
  ON home_slider_banners (organization_id, is_active, sort_order, created_at);

ALTER TABLE home_slider_banners
  ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'link';

ALTER TABLE home_slider_banners
  ADD COLUMN IF NOT EXISTS popup_key TEXT NOT NULL DEFAULT '';

UPDATE home_slider_banners
SET action_type = COALESCE(NULLIF(action_type, ''), 'link')
WHERE action_type IS NULL OR action_type = '';

ALTER TABLE home_slider_banners
  DROP CONSTRAINT IF EXISTS home_slider_banners_action_type_check;

ALTER TABLE home_slider_banners
  ADD CONSTRAINT home_slider_banners_action_type_check
  CHECK (action_type IN ('link', 'popup'));
