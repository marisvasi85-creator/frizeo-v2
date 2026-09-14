export type DataDisposition = "DELETE" | "ANONYMIZE" | "KEEP";

export type AccountDeletionTablePolicy = {
  table: string;
  disposition: DataDisposition;
  notes: string;
};

/**
 * Audit-backed disposition. Never CASCADE-delete a tenant or its bookings
 * just because one user asked to leave.
 */
export const ACCOUNT_DELETION_TABLE_POLICY: AccountDeletionTablePolicy[] = [
  { table: "profiles", disposition: "DELETE", notes: "User profile row; Auth CASCADE also removes it." },
  { table: "user_active_tenant", disposition: "DELETE", notes: "Session pointer for this user only." },
  { table: "tenant_users", disposition: "DELETE", notes: "Membership row for this user only. Tenant remains." },
  { table: "platform_admins", disposition: "DELETE", notes: "Auth CASCADE; not a salon record." },
  { table: "barber_google_accounts", disposition: "DELETE", notes: "OAuth tokens for this barber. Revoke first." },
  { table: "barbers", disposition: "ANONYMIZE", notes: "Keep row for booking FK. Null user_id, deactivate, strip PII." },
  { table: "bookings", disposition: "KEEP", notes: "Salon operational + client records. Never delete on user leave." },
  { table: "booking_cancellations", disposition: "KEEP", notes: "Follows bookings." },
  { table: "barber_services", disposition: "KEEP", notes: "Needed by booking FKs; deactivate public use via barber.active=false." },
  { table: "barber_settings", disposition: "KEEP", notes: "Tied to surviving barber row." },
  { table: "barber_weekly_schedule", disposition: "KEEP", notes: "Tied to surviving barber row." },
  { table: "barber_day_overrides", disposition: "KEEP", notes: "Tied to surviving barber row." },
  { table: "barber_client_access", disposition: "KEEP", notes: "Client access rules for the salon/barber row." },
  { table: "barber_access_request_tokens", disposition: "KEEP", notes: "Follows barber_client_access." },
  { table: "barber_invitations", disposition: "KEEP", notes: "Tenant-level invites; not this user's Auth record." },
  { table: "tenants", disposition: "KEEP", notes: "Never delete a salon from user account deletion." },
  { table: "salon_gallery", disposition: "KEEP", notes: "Tenant media." },
  { table: "salon_reviews", disposition: "KEEP", notes: "Public/salon reviews." },
  { table: "slug_redirects", disposition: "KEEP", notes: "URL integrity." },
  { table: "notification_settings", disposition: "KEEP", notes: "Tenant settings." },
  { table: "subscriptions", disposition: "KEEP", notes: "Billing record. Cancel Stripe only if no members remain." },
  { table: "tenant_fiscal_invoices", disposition: "KEEP", notes: "Legal/fiscal retention. Do not delete." },
  { table: "sms_sends", disposition: "KEEP", notes: "Delivery log; barber_id already SET NULL on barber delete, we do not delete barbers." },
  { table: "marketing_ai_generations", disposition: "KEEP", notes: "Tenant content; barber_id already SET NULL-capable." },
  { table: "marketing_contacts", disposition: "ANONYMIZE", notes: "Unsubscribe + detach user_id. Keep email for suppression." },
  { table: "marketing_consent_events", disposition: "KEEP", notes: "Consent audit." },
  { table: "marketing_unsubscribe_events", disposition: "KEEP", notes: "Suppression audit." },
  { table: "marketing_automation_runs", disposition: "KEEP", notes: "user_id already ON DELETE SET NULL." },
  { table: "marketing_conversions", disposition: "KEEP", notes: "user_id already ON DELETE SET NULL." },
  { table: "marketing_campaigns", disposition: "KEEP", notes: "Platform/tenant marketing; created_by SET NULL." },
  { table: "platform_tenant_notes", disposition: "KEEP", notes: "Ops notes; author_user_id is not an Auth FK." },
  { table: "tenant_lifecycle_state", disposition: "KEEP", notes: "Tenant lifecycle." },
  { table: "account_deletion_requests", disposition: "KEEP", notes: "Audit row. user_id SET NULL after Auth delete." },
  { table: "storage:barber-avatars", disposition: "DELETE", notes: "This barber's avatar objects only." },
  { table: "storage:salon-logos", disposition: "KEEP", notes: "Tenant branding. Not deleted on user leave." },
  { table: "storage:salon-gallery", disposition: "KEEP", notes: "Tenant media." },
  { table: "google_calendar_events", disposition: "KEEP", notes: "Do not delete events from the user's Google Calendar. Disconnect tokens only." },
  { table: "auth.users", disposition: "DELETE", notes: "Last step, server-side admin API only." },
];

export function dispositionFor(table: string): DataDisposition | null {
  return ACCOUNT_DELETION_TABLE_POLICY.find((row) => row.table === table)
    ?.disposition ?? null;
}
