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
