import "server-only";

import { Resend } from "resend";

export type MarketingProviderStatus = {
  provider: "resend";
  domain: "mail.frizeo.ro";
  configured: boolean;
  message: string;
};

export type SendMarketingTestInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendMarketingEmailInput = SendMarketingTestInput & {
  kind: "marketing-test" | "marketing-campaign";
  idempotencyKey?: string;
};

export type SendMarketingEmailResult = {
  provider: "resend";
  messageId: string;
};

export class MarketingProviderError extends Error {
  readonly code: string;
  readonly statusCode: number | null;
  readonly temporary: boolean;
  readonly retryAfterSeconds: number | null;

  constructor(input: {
    code: string;
    message: string;
    statusCode?: number | null;
    temporary: boolean;
    retryAfterSeconds?: number | null;
  }) {
    super(input.message);
    this.name = "MarketingProviderError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? null;
    this.temporary = input.temporary;
    this.retryAfterSeconds = input.retryAfterSeconds ?? null;
  }
}

function readResendConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() || "",
    from: process.env.MARKETING_EMAIL_FROM?.trim() || "",
    replyTo: process.env.MARKETING_EMAIL_REPLY_TO?.trim() || "",
  };
}

export function getMarketingProviderStatus(): MarketingProviderStatus {
  const config = readResendConfig();
  const configured = Boolean(config.apiKey && config.from && config.replyTo);

  return {
    provider: "resend",
    domain: "mail.frizeo.ro",
    configured,
    message: configured
      ? "Resend este configurat pentru teste și campanii."
      : "Lipsesc una sau mai multe variabile Resend necesare pentru trimitere.",
  };
}

function safeProviderError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (error && typeof error === "object") {
    const value = error as { name?: unknown; message?: unknown };
    return {
      name: typeof value.name === "string" ? value.name : "ProviderError",
      message:
        typeof value.message === "string"
          ? value.message
          : "Unknown provider error",
    };
  }

  return { name: "ProviderError", message: "Unknown provider error" };
}

function parseRetryAfter(headers: Record<string, string> | null): number | null {
  const value = Number(headers?.["retry-after"]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(Math.ceil(value), 86_400);
}

function isTemporaryProviderError(input: {
  name: string;
  statusCode: number | null;
}): boolean {
  if (input.statusCode === null) return true;
  if (input.statusCode === 429 || input.statusCode >= 500) return true;
  return (
    input.name === "rate_limit_exceeded" ||
    input.name === "application_error" ||
    input.name === "internal_server_error" ||
    input.name === "concurrent_idempotent_requests"
  );
}

/**
 * Dedicated marketing adapter. It deliberately never imports or falls back to
 * lib/email/email.ts, so booking/transactional delivery remains independent.
 */
export async function sendMarketingEmail(
  input: SendMarketingEmailInput,
): Promise<SendMarketingEmailResult> {
  const status = getMarketingProviderStatus();
  if (!status.configured) {
    throw new Error("marketing_provider_not_configured");
  }

  const config = readResendConfig();

  try {
    const resend = new Resend(config.apiKey);
    const { data, error, headers } = await resend.emails.send(
      {
        from: config.from,
        to: input.to,
        replyTo: config.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: {
          "X-Frizeo-Email-Type": input.kind,
        },
        tags: [
          {
            name: "frizeo_email_type",
            value: input.kind,
          },
        ],
      },
      input.idempotencyKey
        ? { idempotencyKey: input.idempotencyKey }
        : undefined,
    );

    if (error || !data?.id) {
      console.error(
        "[frizeo-email] Resend send failed",
        safeProviderError(error),
      );
      throw new MarketingProviderError({
        code: error?.name || "missing_provider_message_id",
        message: error?.message || "Resend did not return a message id.",
        statusCode: error?.statusCode,
        temporary: error
          ? isTemporaryProviderError(error)
          : true,
        retryAfterSeconds: parseRetryAfter(headers),
      });
    }

    console.info("[frizeo-email] Resend send accepted", {
      kind: input.kind,
      messageId: data.id,
    });

    return {
      provider: "resend",
      messageId: data.id,
    };
  } catch (error) {
    if (error instanceof MarketingProviderError) {
      throw error;
    }

    console.error(
      "[frizeo-email] Resend send failed",
      safeProviderError(error),
    );
    throw new MarketingProviderError({
      code: "network_error",
      message:
        error instanceof Error ? error.message : "Unknown provider error",
      temporary: true,
    });
  }
}

export async function sendMarketingTest(
  input: SendMarketingTestInput,
): Promise<SendMarketingEmailResult> {
  return sendMarketingEmail({ ...input, kind: "marketing-test" });
}
