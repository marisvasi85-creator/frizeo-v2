-- Allow the service-role destination save to run the existing secret-key check.
-- The function body and the rejection trigger stay unchanged.

grant execute on function public.json_contains_secret_key(jsonb, text[]) to service_role;
