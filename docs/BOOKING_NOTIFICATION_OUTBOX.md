# Booking notification outbox

The public booking response can return immediately after the booking is safely
confirmed while Google Calendar, client email, SMS, and barber email run from a
durable per-channel queue.

## Safe rollout order

1. Deploy the code with `BOOKING_NOTIFICATION_OUTBOX_ENABLED=false`.
2. Apply `20260917174543_booking_notification_outbox.sql`.
3. Configure the retry cron:
   `GET /api/cron/booking-notifications?secret=CRON_SECRET` every minute.
4. On staging only, set:
   - `BOOKING_NOTIFICATION_OUTBOX_ENABLED=true`
   - `STAGING_BACKGROUND_JOBS_ENABLED=true`
5. Confirm one QA booking and verify four outbox rows reach `completed`.
6. Test Google-connected and Google-disconnected barbers, email/SMS toggles,
   cancellation, and a forced provider failure/retry.
7. Enable `BOOKING_NOTIFICATION_OUTBOX_ENABLED=true` in production only after
   staging passes.

The dashboard/manual booking flow stays on the existing synchronous path during
this rollout. The public route also falls back to the legacy confirmation path
if the additive RPC has not reached the database yet.

## Rollback

Set `BOOKING_NOTIFICATION_OUTBOX_ENABLED=false` and redeploy. New public
bookings immediately return to the existing synchronous notification flow.
Do not delete the outbox table during rollback; pending rows remain available
for inspection and no worker runs while the flag is disabled.
