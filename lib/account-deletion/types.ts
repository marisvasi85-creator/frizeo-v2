import type { AccountDeletionReason, AccountDeletionStatus } from "./constants";

export type AccountDeletionRequestRow = {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  email_snapshot: string;
  reason: AccountDeletionReason | null;
  reason_details: string | null;
  status: AccountDeletionStatus;
  requested_at: string;
  scheduled_for: string;
  cancelled_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  attempt_count: number;
  claimed_at: string | null;
  claim_token: string | null;
  request_email_sent_at: string | null;
  cancel_email_sent_at: string | null;
  final_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export const ACCOUNT_DELETION_SELECT =
  "id, user_id, tenant_id, email_snapshot, reason, reason_details, status, requested_at, scheduled_for, cancelled_at, completed_at, failure_reason, attempt_count, claimed_at, claim_token, request_email_sent_at, cancel_email_sent_at, final_email_sent_at, created_at, updated_at";
