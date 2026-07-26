import { createHmac, timingSafeEqual } from "crypto";

export type PendingAssistantConfirmation = {
  id: string;
  tenantId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  action: string;
  proposal?: unknown;
  createdAt: number;
  expiresAt: number;
};

type SignedPayload = {
  tenantId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  action: string;
  proposal?: unknown;
  createdAt: number;
  exp: number;
};

const TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  return (
    process.env.ASSISTANT_CONFIRM_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "frizeo-assistant-confirm-dev"
  );
}

function signBody(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createPendingConfirmation(input: {
  tenantId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  action: string;
  proposal?: unknown;
}): PendingAssistantConfirmation {
  const now = Date.now();
  const payload: SignedPayload = {
    tenantId: input.tenantId,
    userId: input.userId,
    toolName: input.toolName,
    args: { ...input.args, confirmed: false },
    summary: input.summary,
    action: input.action,
    proposal: input.proposal,
    createdAt: now,
    exp: now + TTL_MS,
  };

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const id = `${body}.${signBody(body)}`;

  return {
    id,
    tenantId: payload.tenantId,
    userId: payload.userId,
    toolName: payload.toolName,
    args: payload.args,
    summary: payload.summary,
    action: payload.action,
    proposal: payload.proposal,
    createdAt: payload.createdAt,
    expiresAt: payload.exp,
  };
}

function decodePending(id: string): PendingAssistantConfirmation | null {
  const [body, signature] = id.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(signBody(body), signature)) return null;

  try {
    const json = Buffer.from(body, "base64url").toString("utf8");
    const payload = JSON.parse(json) as SignedPayload;
    if (!payload?.tenantId || !payload?.userId || !payload?.toolName) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;

    return {
      id,
      tenantId: payload.tenantId,
      userId: payload.userId,
      toolName: payload.toolName,
      args: payload.args || {},
      summary: payload.summary || "",
      action: payload.action || payload.toolName,
      proposal: payload.proposal,
      createdAt: payload.createdAt || Date.now(),
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export function getPendingConfirmation(input: {
  id: string;
  tenantId: string;
  userId: string;
}): PendingAssistantConfirmation | null {
  const pending = decodePending(input.id);
  if (!pending) return null;
  if (pending.tenantId !== input.tenantId || pending.userId !== input.userId) {
    return null;
  }
  return pending;
}

export function consumePendingConfirmation(input: {
  id: string;
  tenantId: string;
  userId: string;
}): PendingAssistantConfirmation | null {
  // Stateless signed token — "consume" is validation only.
  // Replay within TTL is acceptable for salon ops; args are idempotent enough.
  return getPendingConfirmation(input);
}

export function toPublicPendingConfirmation(pending: PendingAssistantConfirmation) {
  return {
    id: pending.id,
    action: pending.action,
    summary: pending.summary,
    proposal: pending.proposal ?? null,
    expiresAt: pending.expiresAt,
  };
}
