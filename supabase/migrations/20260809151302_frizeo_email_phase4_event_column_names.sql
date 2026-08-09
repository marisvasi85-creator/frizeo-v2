-- Additional event lookup indexes requested by Phase 4 analytics.
-- The first migration already indexes provider_event_id (unique),
-- provider_message_id and campaign recipient relations.

BEGIN;

CREATE INDEX IF NOT EXISTS marketing_email_events_type_time_idx
  ON public.marketing_email_events (type, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS marketing_email_events_time_idx
  ON public.marketing_email_events (event_timestamp DESC);

COMMIT;
