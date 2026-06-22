-- Planuri Frizeo: Free, Pro, Pro+, Custom
-- Rulează în Supabase SQL Editor.

UPDATE plans
SET
  name = 'Free',
  slug = 'free',
  price = 0,
  max_barbers = 1,
  max_bookings_per_month = 80
WHERE slug = 'free'
   OR id = '1bc6a7ca-f1a1-4b7a-812b-aeacbcdaed93';

INSERT INTO plans (name, slug, price, max_barbers, max_bookings_per_month)
SELECT 'Free', 'free', 0, 1, 80
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'free');

UPDATE plans
SET name = 'Pro', price = 59, max_barbers = 1, max_bookings_per_month = NULL
WHERE slug = 'pro';

INSERT INTO plans (name, slug, price, max_barbers, max_bookings_per_month)
SELECT 'Pro', 'pro', 59, 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'pro');

UPDATE plans
SET name = 'Pro+', price = 129, max_barbers = 3, max_bookings_per_month = NULL
WHERE slug = 'pro-plus';

INSERT INTO plans (name, slug, price, max_barbers, max_bookings_per_month)
SELECT 'Pro+', 'pro-plus', 129, 3, NULL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'pro-plus');

UPDATE plans
SET name = 'Custom', price = 0, max_barbers = NULL, max_bookings_per_month = NULL
WHERE slug = 'custom';

INSERT INTO plans (name, slug, price, max_barbers, max_bookings_per_month)
SELECT 'Custom', 'custom', 0, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'custom');
