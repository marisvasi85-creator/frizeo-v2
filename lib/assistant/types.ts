export type AssistantRole = "user" | "assistant" | "system" | "tool";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantToolContext = {
  tenantId: string;
  userId: string;
  role: "owner" | "manager" | "barber";
  barberId: string | null;
  /** Owner may be admin-only (false) or also an active barber (true). */
  actsAsBarber?: boolean;
  /** Only the confirm endpoint may set this — blocks LLM from skipping UI chips. */
  allowConfirmed?: boolean;
};

export type AssistantPendingConfirmationPublic = {
  id: string;
  action: string;
  summary: string;
  proposal?: unknown;
  expiresAt: number;
};

export type AssistantToolResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

export type AssistantToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    ctx: AssistantToolContext,
  ) => Promise<AssistantToolResult>;
};

export type AssistantRunResult = {
  reply: string;
  toolsUsed: string[];
  pendingConfirmation?: AssistantPendingConfirmationPublic | null;
};
