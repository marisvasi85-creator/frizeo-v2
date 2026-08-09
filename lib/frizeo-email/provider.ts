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

export type SendMarketingTestResult = {
  provider: "resend";
  messageId: string;
};

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
      ? "Resend este configurat pentru Send Test."
      : "Lipsesc una sau mai multe variabile Resend necesare pentru Send Test.",
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

/**
 * Dedicated marketing adapter. It deliberately never imports or falls back to
 * lib/email/email.ts, so booking/transactional delivery remains independent.
 */
export async function sendMarketingTest(
  input: SendMarketingTestInput,
): Promise<SendMarketingTestResult> {
  const status = getMarketingProviderStatus();
  if (!status.configured) {
    throw new Error("marketing_provider_not_configured");
  }

  const config = readResendConfig();

  try {
    const resend = new Resend(config.apiKey);
    const { data, error } = await resend.emails.send({
      from: config.from,
      to: input.to,
      replyTo: config.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: {
        "X-Frizeo-Email-Type": "marketing-test",
      },
    });

    if (error || !data?.id) {
      console.error(
        "[frizeo-email] Resend Send Test failed",
        safeProviderError(error),
      );
      throw new Error("marketing_provider_send_failed");
    }

    console.info("[frizeo-email] Resend Send Test accepted", {
      messageId: data.id,
    });

    return {
      provider: "resend",
      messageId: data.id,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "marketing_provider_send_failed"
    ) {
      throw error;
    }

    console.error(
      "[frizeo-email] Resend Send Test failed",
      safeProviderError(error),
    );
    throw new Error("marketing_provider_send_failed");
  }
}
