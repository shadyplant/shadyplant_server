CREATE INDEX IF NOT EXISTS orders_created_at_desc_idx
  ON orders (created_at DESC);

CREATE INDEX IF NOT EXISTS orders_user_id_created_at_desc_idx
  ON orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_user_id_current_status_idx
  ON orders (user_id, current_status);

CREATE INDEX IF NOT EXISTS orders_payment_details_merchant_order_id_idx
  ON orders ((payment_details->>'merchantOrderId'));

CREATE INDEX IF NOT EXISTS orders_payment_details_gateway_order_id_idx
  ON orders ((payment_details->>'gatewayOrderId'));

CREATE INDEX IF NOT EXISTS orders_payment_details_cashfree_order_id_idx
  ON orders ((payment_details->>'cashfreeOrderId'));

CREATE INDEX IF NOT EXISTS payment_attempts_created_at_desc_idx
  ON payment_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS payment_attempts_user_id_created_at_desc_idx
  ON payment_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_attempts_razorpay_gateway_order_id_idx
  ON payment_attempts ((razorpay->>'gatewayOrderId'));

CREATE INDEX IF NOT EXISTS coupon_codes_reserved_reference_idx
  ON coupon_codes (reserved_reference);
