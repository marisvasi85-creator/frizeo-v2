import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export type EncryptedSecret = {
  ciphertext: Buffer;
  nonce: Buffer;
  keyVersion: 1;
};

export function readIntegrationEncryptionKey(): Buffer | null {
  const raw = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) return null;
    return key;
  } catch {
    return null;
  }
}

export function encryptIntegrationSecret(
  plaintext: string,
): EncryptedSecret | { error: "encryption_unconfigured" } {
  const key = readIntegrationEncryptionKey();
  if (!key) return { error: "encryption_unconfigured" };

  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]),
    nonce,
    keyVersion: 1,
  };
}

export function decryptIntegrationSecret(
  secret: EncryptedSecret,
): string | { error: "encryption_unconfigured" | "decrypt_failed" } {
  const key = readIntegrationEncryptionKey();
  if (!key) return { error: "encryption_unconfigured" };
  if (secret.ciphertext.length < TAG_BYTES) return { error: "decrypt_failed" };

  try {
    const tag = secret.ciphertext.subarray(secret.ciphertext.length - TAG_BYTES);
    const body = secret.ciphertext.subarray(0, secret.ciphertext.length - TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, key, secret.nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return { error: "decrypt_failed" };
  }
}
