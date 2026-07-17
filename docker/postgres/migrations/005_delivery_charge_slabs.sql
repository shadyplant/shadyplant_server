CREATE TABLE IF NOT EXISTS delivery_charge_profiles (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_charge_profiles_code_unique_idx
  ON delivery_charge_profiles (code);

CREATE INDEX IF NOT EXISTS delivery_charge_profiles_active_sort_idx
  ON delivery_charge_profiles (is_active, sort_order, created_at);

CREATE TABLE IF NOT EXISTS delivery_charge_slabs (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES delivery_charge_profiles(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  calculation_mode TEXT NOT NULL
    CHECK (calculation_mode IN ('flat', 'per_distance', 'per_weight_unit')),
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  weight_unit_kg NUMERIC(12,2) NOT NULL DEFAULT 20,
  min_weight_kg NUMERIC(12,2),
  min_weight_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
  max_weight_kg NUMERIC(12,2),
  max_weight_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
  min_distance_km NUMERIC(12,2),
  min_distance_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
  max_distance_km NUMERIC(12,2),
  max_distance_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (rate >= 0),
  CHECK (weight_unit_kg > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_charge_slabs_profile_rule_unique_idx
  ON delivery_charge_slabs (profile_id, rule_key);

CREATE INDEX IF NOT EXISTS delivery_charge_slabs_profile_active_sort_idx
  ON delivery_charge_slabs (profile_id, is_active, sort_order, created_at);

CREATE INDEX IF NOT EXISTS delivery_charge_slabs_profile_mode_sort_idx
  ON delivery_charge_slabs (profile_id, calculation_mode, sort_order, created_at);
