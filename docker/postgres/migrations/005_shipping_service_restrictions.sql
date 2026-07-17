CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY,
  iso2 TEXT NOT NULL,
  iso3 TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT countries_iso2_length_check CHECK (char_length(iso2) = 2),
  CONSTRAINT countries_iso3_length_check CHECK (char_length(iso3) = 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS countries_iso2_unique_idx
  ON countries (iso2);

CREATE UNIQUE INDEX IF NOT EXISTS countries_iso3_unique_idx
  ON countries (iso3);

CREATE TABLE IF NOT EXISTS states (
  id UUID PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT states_code_length_check CHECK (char_length(code) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS states_country_code_unique_idx
  ON states (country_id, code);

CREATE INDEX IF NOT EXISTS states_country_id_idx
  ON states (country_id);

CREATE TABLE IF NOT EXISTS shipping_regions (
  id UUID PRIMARY KEY,
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  default_service BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS shipping_regions_state_id_unique_idx
  ON shipping_regions (state_id);

CREATE INDEX IF NOT EXISTS shipping_regions_state_id_idx
  ON shipping_regions (state_id);

CREATE TABLE IF NOT EXISTS shipping_rules (
  id UUID PRIMARY KEY,
  shipping_region_id UUID NOT NULL REFERENCES shipping_regions(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('ALLOW', 'BLOCK')),
  rule_type TEXT NOT NULL
    CHECK (rule_type IN ('PIN', 'PIN_RANGE', 'CITY', 'DISTRICT', 'POLYGON', 'LATLNG')),
  pin TEXT,
  start_pin TEXT,
  end_pin TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shipping_rules_payload_shape_check CHECK (
    (
      rule_type = 'PIN'
      AND pin IS NOT NULL
      AND start_pin IS NULL
      AND end_pin IS NULL
    )
    OR (
      rule_type = 'PIN_RANGE'
      AND pin IS NULL
      AND start_pin IS NOT NULL
      AND end_pin IS NOT NULL
    )
    OR (
      rule_type IN ('CITY', 'DISTRICT', 'POLYGON', 'LATLNG')
      AND pin IS NULL
      AND start_pin IS NULL
      AND end_pin IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS shipping_rules_shipping_region_id_idx
  ON shipping_rules (shipping_region_id);

CREATE INDEX IF NOT EXISTS shipping_rules_pin_idx
  ON shipping_rules (pin);

CREATE INDEX IF NOT EXISTS shipping_rules_start_pin_end_pin_idx
  ON shipping_rules (start_pin, end_pin);

CREATE INDEX IF NOT EXISTS shipping_rules_action_idx
  ON shipping_rules (action);

CREATE INDEX IF NOT EXISTS shipping_rules_rule_type_idx
  ON shipping_rules (rule_type);

CREATE UNIQUE INDEX IF NOT EXISTS shipping_rules_unique_pin_idx
  ON shipping_rules (shipping_region_id, action, rule_type, pin)
  WHERE rule_type = 'PIN';

CREATE UNIQUE INDEX IF NOT EXISTS shipping_rules_unique_pin_range_idx
  ON shipping_rules (shipping_region_id, action, rule_type, start_pin, end_pin)
  WHERE rule_type = 'PIN_RANGE';
