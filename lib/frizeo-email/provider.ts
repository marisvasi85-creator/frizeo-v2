import nodemailer from "nodemailer";

export type MarketingProviderStatus = {
  provider: "smtp";
  configured: boolean;
  message: string;
};

export type SendMarketingTestInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  senderName: string;
  senderEmail: string;
  replyTo: string | null;
};

export type SendMarketingTestResult = {
  provider: "smtp";
  messageId: string;
};

function readMarketingSmtpConfig() {
  const host = process.env.MARKETING_EMAIL_HOST?.trim() || "";
  const port = Number(process.env.MARKETING_EMAIL_PORT || 587);
  const user = process.env.MARKETING_EMAIL_USER?.trim() || "";
  const pass = process.env.MARKETING_EMAIL_PASS || "";
  const secureFromEnv = process.env.MARKETING_EMAIL_SECURE?.trim().toLowerCase();
  const secure =
    secureFromEnv === "true" ||
    (secureFromEnv !== "false" && Number.isFinite(port) && port === 465);

  return { host, port, user, pass, secure };
}

export function getMarketingProviderStatus(): MarketingProviderStatus {
  const config = readMarketingSmtpConfig();
  const configured = Boolean(
    config.host &&
      Number.isFinite(config.port) &&
      config.port > 0 &&
      config.user &&
      config.pass,
  );

  return {
    provider: "smtp",
    configured,
    message: configured
      ? "Providerul SMTP de marketing este configurat pentru Send Test."
      : "Lipsesc variabilele MARKETING_EMAIL_*; emailurile tranzacționale nu sunt folosite ca fallback.",
  };
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

  const config = readMarketingSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const result = await transporter.sendMail({
    from: {
      name: input.senderName,
      address: input.senderEmail,
    },
    to: input.to,
    replyTo: input.replyTo || undefined,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: {
      "X-Frizeo-Email-Type": "marketing-test",
    },
  });

  return {
    provider: "smtp",
    messageId: result.messageId,
  };
}
