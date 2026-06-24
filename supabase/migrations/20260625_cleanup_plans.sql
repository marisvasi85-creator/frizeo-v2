-- Curăță planuri vechi (Solo, Business, duplicate Pro etc.)
-- Păstrează doar: free, pro, pro-plus, custom
-- Rulează în Supabase SQL Editor.

-- 1. Asigură cele 4 planuri canonice
INSERT INTO plans (name, slug, price, max_barbers, max_bookings_per_month)
SELECT 'Free', 'free', 0, 1, 80
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'free');

INSERT INTO plans (name, slug, price, max_barbers, max_bookings_per_month)
SELECT 'Pro', 'pro', 59, 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'pro');

INSERT INTO plans (name, slug, price, max_barbers, max_bookings_per_month)
SELECT 'Pro+', 'pro-plus', 129, 3, NULL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'pro-plus');

INSERT INTO plans (name, slug, price, max_barbers, max_bookings_per_month)
SELECT 'Custom', 'custom', 0, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'custom');

UPDATE plans SET name = 'Free', price = 0, max_barbers = 1, max_bookings_per_month = 80 WHERE slug = 'free';
UPDATE plans SET name = 'Pro', price = 59, max_barbers = 1, max_bookings_per_month = NULL WHERE slug = 'pro';
UPDATE plans SET name = 'Pro+', price = 129, max_barbers = 3, max_bookings_per_month = NULL WHERE slug = 'pro-plus';
UPDATE plans SET name = 'Custom', price = 0, max_barbers = NULL, max_bookings_per_month = NULL WHERE slug = 'custom';

-- 2. Un singur rând per slug canonic (cel mai vechi id)
WITH keepers AS (
  SELECT DISTINCT ON (slug) id, slug
  FROM plans
  WHERE slug IN ('free', 'pro', 'pro-plus', 'custom')
  ORDER BY slug, id
)
UPDATE subscriptions s
SET plan_id = k.id
FROM plans p
JOIN keepers k ON k.slug = p.slug
WHERE s.plan_id = p.id
  AND p.slug IN ('free', 'pro', 'pro-plus', 'custom')
  AND s.plan_id <> k.id;

-- 3. Solo / Pro vechi → Pro
UPDATE subscriptions s
SET plan_id = (SELECT id FROM plans WHERE slug = 'pro' ORDER BY id LIMIT 1)
FROM plans p
WHERE s.plan_id = p.id
  AND p.slug NOT IN ('free', 'pro', 'pro-plus', 'custom')
  AND (
    lower(p.slug) IN ('solo', 'pro-old')
    OR lower(trim(p.name)) IN ('solo', 'pro')
    OR (coalesce(p.max_barbers, 1) = 1 AND coalesce(p.price, 0) > 0)
  );

-- 4. Business → Custom
UPDATE subscriptions s
SET plan_id = (SELECT id FROM plans WHERE slug = 'custom' ORDER BY id LIMIT 1)
FROM plans p
WHERE s.plan_id = p.id
  AND p.slug NOT IN ('free', 'pro', 'pro-plus', 'custom')
  AND (
    lower(p.slug) IN ('business', 'bussiness', 'busines')
    OR lower(trim(p.name)) LIKE 'business%'
  );

-- 5. Echipă / Pro+ vechi → Pro+
UPDATE subscriptions s
SET plan_id = (SELECT id FROM plans WHERE slug = 'pro-plus' ORDER BY id LIMIT 1)
FROM plans p
WHERE s.plan_id = p.id
  AND p.slug NOT IN ('free', 'pro', 'pro-plus', 'custom')
  AND (
    lower(p.slug) IN ('pro+', 'pro_plus', 'team', 'pro-plus-old')
    OR lower(trim(p.name)) IN ('pro+', 'pro plus')
    OR coalesce(p.max_barbers, 0) >= 3
  );

-- 6. Orice alt plan necunoscut → Free
UPDATE subscriptions s
SET plan_id = (SELECT id FROM plans WHERE slug = 'free' ORDER BY id LIMIT 1)
FROM plans p
WHERE s.plan_id = p.id
  AND p.slug NOT IN ('free', 'pro', 'pro-plus', 'custom');

-- 7. Șterge planurile non-canonice
DELETE FROM plans
WHERE slug NOT IN ('free', 'pro', 'pro-plus', 'custom');

-- 8. Dedupe dacă au rămas duplicate pe același slug
WITH ranked AS (
  SELECT
    id,
    slug,
    row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM plans
  WHERE slug IN ('free', 'pro', 'pro-plus', 'custom')
),
dupes AS (
  SELECT id FROM ranked WHERE rn > 1
),
keepers AS (
  SELECT id, slug FROM ranked WHERE rn = 1
)
UPDATE subscriptions s
SET plan_id = k.id
FROM dupes d
JOIN plans p ON p.id = d.id
JOIN keepers k ON k.slug = p.slug
WHERE s.plan_id = d.id;

DELETE FROM plans
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
    FROM plans
    WHERE slug IN ('free', 'pro', 'pro-plus', 'custom')
  ) x
  WHERE rn > 1
);
