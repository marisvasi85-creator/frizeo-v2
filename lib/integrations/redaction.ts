const SECRET_KEY = /access_token|refresh_token|client_secret|code_verifier|pkce|ciphertext|nonce|authorization|api_key|secret|token/i;

export function isSecretField(key: string): boolean {
  return SECRET_KEY.test(key);
}

export function redactIntegrationRecord(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactIntegrationRecord(item));
  }
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretField(key)) continue;
    output[key] = redactIntegrationRecord(nested);
  }
  return output;
}

export function safeErrorText(value: string | null | undefined): string | null {
  if (!value) return null;
  if (SECRET_KEY.test(value) || /eyJ[A-Za-z0-9_-]{10,}/.test(value)) {
    return "Eroare internă. Detaliile sensibile au fost omise.";
  }
  return value.slice(0, 300);
}
