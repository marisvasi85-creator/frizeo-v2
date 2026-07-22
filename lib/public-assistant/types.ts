export type PublicChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PublicToolContext = {
  tenantId: string;
  salonName: string;
  salonSlug: string;
  /** When visitor is on a specific barber booking page */
  barberId: string | null;
  barberName: string | null;
  barberSlug: string | null;
};

export type PublicToolResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

export type PublicToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    ctx: PublicToolContext,
  ) => Promise<PublicToolResult>;
};

export type PublicRunResult = {
  reply: string;
  toolsUsed: string[];
};
