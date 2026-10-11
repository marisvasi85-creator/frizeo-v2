# Frizeo 2.0 — Meta OAuth (milestone 1)

Staging only. This connects Facebook Login for Business, lists Facebook Pages and linked Instagram professional accounts, and stores the user token encrypted. It does not publish.

## Environment

Server-only. None of these are `NEXT_PUBLIC_`.

- `META_APP_ID` must be `2094935131390397`
- `META_APP_SECRET` is set manually. The app does not invent it and does not log it.
- `META_LOGIN_CONFIGURATION_ID` must be `2325264384883936` (`Frizeo Meta Connect`)
- `META_OAUTH_REDIRECT_URI` must be `https://staging.frizeo.ro/api/integrations/meta/callback`
- `INTEGRATION_TOKEN_ENCRYPTION_KEY` is the existing 32-byte base64 key

If any value is missing or the process is production, connect returns no Meta redirect. The capability `marketing.publish.meta` stays off until it is enabled for one staging tenant. A missing row is off.

## OAuth

The dialog is `https://www.facebook.com/v26.0/dialog/oauth` with `config_id`, `response_type=code`, `override_default_response_type=true`, `state`, and PKCE S256. Scopes come from the Meta configuration, not from a `scope` query parameter. The browser redirect never includes the app secret, the code verifier, or an access token.

The callback `GET /api/integrations/meta/callback` checks the HMAC state, expiry, single use, user, tenant, and provider before the server exchanges the code. The exchange is `GET graph.facebook.com/v26.0/oauth/access_token` with the app secret and the code verifier. A short-lived token is exchanged with `grant_type=fb_exchange_token`. `debug_token` must belong to this app id and include:

- `business_management`
- `instagram_basic`
- `instagram_content_publish`
- `pages_read_engagement`
- `pages_show_list`

Missing permissions are stored as status `error`, not `connected`. A failed exchange writes no connection. The user token is AES-256-GCM ciphertext in `private.marketing_connection_secrets`.

User tokens are refreshed only by reconnect. There is no cron. A usable token needs a finite future expiry from at least one of `expires_in`, `debug_token.data.expires_at` greater than 0, or `debug_token.data.data_access_expires_at` greater than 0. The earliest of those bounds is stored. `expires_at` of 0, or a missing expiry with no other finite bound, is unknown and the callback does not save the connection. An already-expired bound is not saved either. A stored `token_expires_at` that is missing, unparseable, or in the past is shown as needs reconnect, and page discovery refuses it, without calling Graph on page load.

## Discovery

`POST /api/integrations/meta/destinations` calls `GET /v26.0/me/accounts?fields=id,name,tasks,instagram_business_account{id,username}`. Meta documents `instagram_business_account` as the Instagram professional account (Business or Creator) linked to the Page. The call does not request a separate account-type field, because that field is not part of this documented Page response. A page may have no Instagram account. Nothing is selected automatically.

Graph can return `paging.next`. The server accepts that URL only when it is `https://graph.facebook.com/v26.0/me/accounts` or `https://graph.facebook.com/v26.0/<page id>/accounts`, then rebuilds the next request to `me/accounts` with the `after` cursor and the Authorization header. It does not request the raw `next` URL. An unexpected host, path, or cursor fails the whole discovery. At most 4 pages and 100 results are accepted; another `next` after that is a limit, not a partial success.

Page `access_token` values returned by Graph are not stored, not returned to the browser, not written into destination metadata, and not logged. Facebook Page publishing is a later milestone. That work must obtain a page access token on demand from the stored user token, encrypt it separately, and keep it out of `metadata`, API responses, the UI, and logs. This milestone does not store page tokens and does not publish.

Each Graph request reserves at most 1.5 seconds from an 8 second budget, which stays under the Hobby `maxDuration` of 10 seconds. A timed-out call is not retried. The optional profile name is skipped when the budget is gone; token exchange, `debug_token`, and page listing fail closed instead.

`POST /api/integrations/meta/destinations/select` reads Graph again and only then writes `marketing_destinations` and sets the connection to `connected`.

## Disconnect

Local rows and secrets for that tenant's Meta connection are deleted. `DELETE /v26.0/me/permissions` runs only when a token can be decrypted. The UI says Meta confirmed revocation only when that call returns `success: true`.

## Not in this milestone

Publishing, scheduling, Reels, Stories, comments, insights, ads, webhooks, crons, and polling are not implemented. Account deletion is unchanged.

Meta App Review later needs two separate endpoints, not the current account-deletion flow:

- Deauthorize callback: `POST /api/integrations/meta/deauthorize`
- Data deletion request: `POST /api/integrations/meta/data-deletion`, returning a confirmation code and a status URL

Those routes are not implemented. The unpublished app can be tested with users who have a role on the Meta app.
