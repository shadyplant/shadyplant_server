CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL
    CHECK (zone_type IN ('service', 'restriction')),
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  fill_color TEXT NOT NULL DEFAULT '',
  stroke_color TEXT NOT NULL DEFAULT '',
  opacity NUMERIC(4,3) NOT NULL DEFAULT 0.280,
  polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
  vertices JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS shipping_zones_name_unique_idx
  ON shipping_zones (LOWER(name));

CREATE INDEX IF NOT EXISTS shipping_zones_zone_type_idx
  ON shipping_zones (zone_type);

CREATE INDEX IF NOT EXISTS shipping_zones_is_active_idx
  ON shipping_zones (is_active);

CREATE INDEX IF NOT EXISTS shipping_zones_created_at_idx
  ON shipping_zones (created_at DESC);
