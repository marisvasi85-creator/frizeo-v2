-- Redirect pentru schimbarea slug-ului salonului SocoBarberShop (wassell-salon → socobarbershop).
-- Rulează după 20260714_slug_redirects.sql.

INSERT INTO public.slug_redirects (entity_type, entity_id, old_slug, tenant_id)
SELECT
  'tenant',
  t.id,
  'wassell-salon',
  NULL
FROM public.tenants t
WHERE t.slug = 'socobarbershop'
  AND NOT EXISTS (
    SELECT 1
    FROM public.slug_redirects r
    WHERE r.entity_type = 'tenant'
      AND r.old_slug = 'wassell-salon'
  );
