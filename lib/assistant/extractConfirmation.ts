import {
  createPendingConfirmation,
  toPublicPendingConfirmation,
  type PendingAssistantConfirmation,
} from "./pendingConfirmations";
import type {
  AssistantPendingConfirmationPublic,
  AssistantToolContext,
  AssistantToolResult,
} from "./types";

export function extractNeedsConfirmation(
  toolName: string,
  args: Record<string, unknown>,
  result: AssistantToolResult,
  ctx: AssistantToolContext,
): {
  pending: PendingAssistantConfirmation;
  publicPending: AssistantPendingConfirmationPublic;
} | null {
  if (!result.ok || !result.data || typeof result.data !== "object") {
    return null;
  }

  const data = result.data as Record<string, unknown>;
  if (data.needs_confirmation !== true) return null;

  const action =
    typeof data.action === "string" && data.action.trim()
      ? data.action
      : toolName;

  const pending = createPendingConfirmation({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    toolName,
    args,
    summary: result.summary,
    action,
    proposal: data.proposal,
  });

  return {
    pending,
    publicPending: toPublicPendingConfirmation(pending),
  };
}
