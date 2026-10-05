# Frizeo 2.0 — integration foundation

Staging-only foundation. No provider calls, no new cron, no Stripe changes.

## Environment

`INTEGRATION_TOKEN_ENCRYPTION_KEY`

Server-only. 32 bytes, base64. Used for AES-256-GCM token ciphertext and for the HMAC of OAuth state. The app does not invent a value. If the variable is missing, token storage and OAuth state creation fail closed.

`SUPABASE_URL` is not read. Client, server, and service-role clients use `NEXT_PUBLIC_SUPABASE_URL`.

## Table names

`public.marketing_campaigns` already belongs to Frizeo Email. The new campaign, asset, and publish-job tables are `integration_campaigns`, `integration_assets`, and `integration_publish_jobs`. Email campaigns are not altered.

## Capabilities

`tenant_capabilities` stores explicit overrides. A missing row is off. Current plans (`free`, `pro`, `pro-plus`, `custom`) are not mapped to these capabilities. Existing Marketing AI does not read `marketing.generate`.

## Tokens

`marketing_connections` has no token columns. Ciphertext is stored in `private.marketing_connection_secrets`, which is not granted to `anon` or `authenticated`. Decrypt happens only on the server and the plaintext is not returned by the settings page or Integration Lab.

## OAuth

State is random, stored as an HMAC, and bound to `tenant_id` plus `user_id`. The callback helper rejects a session whose active tenant or user differs from the stored row. PKCE S256 material can be encrypted with the same key. No provider authorize URL is called.

## Publish and webhooks

Provider adapters return `not_implemented`. Mock jobs stay `draft` and do not set a provider post id. `/api/webhooks/meta`, `/api/webhooks/tiktok`, and `/api/webhooks/whatsapp` return 404 `not_configured`. They do not claim signature verification. `integration_webhook_events` dedupes `(provider, external_event_id)` and does not store the raw payload.

## Credits

`credit_ledger` is append-only. A debit consumes the soonest-expiring grant that was still valid at the debit time. When that grant expires, its unused remainder leaves the balance with it, so the debit does not reduce a later grant. `private.apply_credit_debit` takes a per-tenant advisory lock, ignores a duplicate idempotency key, and refuses a debit above that balance. There is no Stripe checkout and no credit sale.

## Account deletion

The current deletion flow is unchanged. When that flow is extended, tenant delete should rely on the foreign keys added here:

- `tenant_capabilities`, `marketing_connections`, `marketing_destinations`, `integration_campaigns`, `integration_assets`, `integration_publish_jobs`, `usage_ledger`, and `credit_ledger` cascade with the tenant.
- `private.marketing_connection_secrets` cascades from the connection.
- `private.integration_oauth_states` cascades with the tenant.
- `integration_webhook_events.tenant_id` is set null. Rows are not tenant-owned payloads. A later deletion pass can remove events explicitly if a retention rule requires it.
- Do not add this cleanup to the current finalizer until that pass is reviewed. Booking rows, Google Calendar tokens, and Stripe records stay on their existing path.

## Performance

Settings and Integration Lab read on request. There is no poll, cron, or background validation. Future refresh and publish work should reuse a leased job row, not a permanent worker, and should stay off until a provider milestone turns it on.
