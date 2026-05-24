CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT NOT NULL,
  password_hash TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'local'
    CHECK (auth_provider IN ('local', 'google', 'hybrid')),
  google_uid TEXT,
  profile_image TEXT,
  delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  billing_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_access JSONB NOT NULL DEFAULT '{"cashOnDelivery":true,"onlinePayment":true,"emi":false}'::jsonb,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  customer_category TEXT NOT NULL DEFAULT 'normal'
    CHECK (customer_category IN ('normal', 'nursery_owner', 'garden_contractor')),
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'banned_temporary', 'banned_permanent')),
  banned_until TIMESTAMPTZ,
  ban_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique_idx
  ON users (phone_number)
  WHERE phone_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_uid_unique_idx
  ON users (google_uid)
  WHERE google_uid IS NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_access JSONB NOT NULL DEFAULT '{"cashOnDelivery":true,"onlinePayment":true,"emi":false}'::jsonb;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS customer_category TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ban_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_customer_category_check;

ALTER TABLE users
  ADD CONSTRAINT users_customer_category_check
  CHECK (customer_category IN ('normal', 'nursery_owner', 'garden_contractor'));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('active', 'banned_temporary', 'banned_permanent'));

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique_idx
  ON organizations (LOWER(slug));

CREATE TABLE IF NOT EXISTS staff_accounts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin', 'manager', 'catalog', 'operations', 'support')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_email_unique_idx
  ON staff_accounts (LOWER(email));

CREATE INDEX IF NOT EXISTS staff_accounts_organization_id_idx
  ON staff_accounts (organization_id);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  user_agent TEXT NOT NULL DEFAULT 'unknown',
  expires_at TIMESTAMPTZ NOT NULL,
  replaced_by_session_id UUID,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx
  ON sessions (user_id);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  tracking_code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_date TIMESTAMPTZ NOT NULL,
  quantity_sqft INTEGER NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL,
  vehicle JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  billing_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_location JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  current_status TEXT NOT NULL DEFAULT 'placed'
    CHECK (
      current_status IN (
        'placed',
        'confirmed',
        'preparing',
        'scheduled',
        'dispatched',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'refunded'
      )
    ),
  tracking_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancellation_reason TEXT NOT NULL DEFAULT '',
  cancellation_note TEXT NOT NULL DEFAULT '',
  cancelled_at TIMESTAMPTZ,
  refund_reason TEXT NOT NULL DEFAULT '',
  refunded_at TIMESTAMPTZ,
  pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx
  ON orders (user_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_location JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS current_status TEXT NOT NULL DEFAULT 'placed';

ALTER TABLE orders
  ALTER COLUMN current_status SET DEFAULT 'placed';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_timeline JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancellation_note TEXT NOT NULL DEFAULT '';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_current_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_current_status_check
  CHECK (
    current_status IN (
      'placed',
      'confirmed',
      'preparing',
      'scheduled',
      'dispatched',
      'shipped',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'refunded'
    )
  );

CREATE TABLE IF NOT EXISTS coupon_codes (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('adjust', 'discount')),
  adjust_amount INTEGER NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'used', 'expired')),
  usage_mode TEXT NOT NULL DEFAULT 'one_time'
    CHECK (usage_mode IN ('one_time')),
  total_uses_allowed INTEGER NOT NULL DEFAULT 1
    CHECK (total_uses_allowed > 0),
  total_uses_redeemed INTEGER NOT NULL DEFAULT 0
    CHECK (total_uses_redeemed >= 0),
  redeemed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  reserved_reference TEXT,
  reserved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_by_staff_account_id UUID REFERENCES staff_accounts(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (type = 'adjust' AND adjust_amount > 0 AND discount_percent = 0)
    OR
    (type = 'discount' AND discount_percent > 0 AND adjust_amount = 0)
  ),
  CHECK (total_uses_redeemed <= total_uses_allowed)
);

CREATE UNIQUE INDEX IF NOT EXISTS coupon_codes_code_unique_idx
  ON coupon_codes (LOWER(code));

CREATE INDEX IF NOT EXISTS coupon_codes_status_created_idx
  ON coupon_codes (status, created_at DESC);

CREATE INDEX IF NOT EXISTS coupon_codes_type_created_idx
  ON coupon_codes (type, created_at DESC);

ALTER TABLE coupon_codes
  ADD COLUMN IF NOT EXISTS reserved_reference TEXT;

ALTER TABLE coupon_codes
  ADD COLUMN IF NOT EXISTS reserved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE coupon_codes
  ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ;

ALTER TABLE coupon_codes
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  checkout_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  last_webhook_event TEXT,
  razorpay JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_attempts_user_id_idx
  ON payment_attempts (user_id);

CREATE INDEX IF NOT EXISTS payment_attempts_razorpay_order_id_idx
  ON payment_attempts ((razorpay->>'orderId'));

CREATE TABLE IF NOT EXISTS app_runtime_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_staff_account_id UUID REFERENCES staff_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_runtime_settings_updated_idx
  ON app_runtime_settings (updated_at DESC);

CREATE TABLE IF NOT EXISTS service_catalog (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_catalog_organization_slug_unique_idx
  ON service_catalog (organization_id, LOWER(slug));

CREATE INDEX IF NOT EXISTS service_catalog_organization_id_idx
  ON service_catalog (organization_id);

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  author_name TEXT NOT NULL DEFAULT 'Anonymous buyer',
  author_location TEXT NOT NULL DEFAULT '',
  verified_buyer BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS admin_reply_body TEXT NOT NULL DEFAULT '';

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS admin_reply_author_name TEXT NOT NULL DEFAULT '';

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS admin_reply_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_product_user_unique_idx
  ON product_reviews (product_id, user_id);

CREATE INDEX IF NOT EXISTS product_reviews_product_status_created_idx
  ON product_reviews (product_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS product_stock_alerts (
  id UUID PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'notified', 'dismissed')),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_stock_alerts_product_user_unique_idx
  ON product_stock_alerts (product_id, user_id);

CREATE INDEX IF NOT EXISTS product_stock_alerts_product_status_created_idx
  ON product_stock_alerts (product_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS product_stock_alerts_user_status_created_idx
  ON product_stock_alerts (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS home_category_items (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '/search',
  image TEXT NOT NULL DEFAULT '',
  accent_from TEXT NOT NULL DEFAULT '#d8c38f',
  accent_via TEXT NOT NULL DEFAULT '#f0d9a6',
  accent_to TEXT NOT NULL DEFAULT '#fbf3cf',
  show_offer_badge BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS home_category_items_org_key_unique_idx
  ON home_category_items (organization_id, LOWER(item_key));

CREATE INDEX IF NOT EXISTS home_category_items_org_active_sort_idx
  ON home_category_items (organization_id, is_active, sort_order, created_at);

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
