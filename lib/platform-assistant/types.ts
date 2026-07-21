export type PlatformChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PlatformToolContext = {
  userId: string;
  email: string;
};

export type PlatformToolResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

export type PlatformToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    ctx: PlatformToolContext,
  ) => Promise<PlatformToolResult>;
};

export type PlatformRunResult = {
  reply: string;
  toolsUsed: string[];
};
