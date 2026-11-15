import { createHmac, timingSafeEqual } from "node:crypto";

const USER_ID = /^[0-9]{1,32}$/;

function decodeBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

export function readMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): { ok: true; userId: string } | { ok: false; reason: "invalid" } {
  const secret = appSecret.trim();
  const [encodedSig, encodedPayload, extra] = signedRequest.split(".");
  if (!secret || !encodedSig || !encodedPayload || extra !== undefined) {
    return { ok: false, reason: "invalid" };
  }
  const signature = decodeBase64Url(encodedSig);
  const payload = decodeBase64Url(encodedPayload);
  if (!signature || !payload || signature.length === 0) return { ok: false, reason: "invalid" };
  const expected = createHmac("sha256", secret).update(encodedPayload).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return { ok: false, reason: "invalid" };
  }
  let body: { algorithm?: unknown; user_id?: unknown };
  try {
    body = JSON.parse(payload.toString("utf8")) as { algorithm?: unknown; user_id?: unknown };
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (body.algorithm !== "HMAC-SHA256") return { ok: false, reason: "invalid" };
  const userId = typeof body.user_id === "string" || typeof body.user_id === "number"
    ? String(body.user_id)
    : "";
  if (!USER_ID.test(userId)) return { ok: false, reason: "invalid" };
  return { ok: true, userId };
}

export function signMetaRequest(payload: { user_id: string }, appSecret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify({
    algorithm: "HMAC-SHA256",
    user_id: payload.user_id,
  }), "utf8").toString("base64url");
  const signature = createHmac("sha256", appSecret).update(encodedPayload).digest("base64url");
  return `${signature}.${encodedPayload}`;
}

export function issueMetaDeletionCode(input: {
  appSecret: string;
  removed: number;
  issuedAt: number;
  nonce: string;
}): string | null {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(input.nonce)) return null;
  if (!Number.isInteger(input.issuedAt) || input.issuedAt <= 0) return null;
  if (!Number.isInteger(input.removed) || input.removed < 0 || input.removed > 1000) return null;
  const body = `${input.issuedAt}.${input.removed}.${input.nonce}`;
  const signature = createHmac("sha256", input.appSecret).update(body).digest("base64url");
  return `${Buffer.from(body, "utf8").toString("base64url")}.${signature}`;
}

export function readMetaDeletionCode(
  code: string,
  appSecret: string,
): { ok: true; issuedAt: number } | { ok: false } {
  const secret = appSecret.trim();
  const [encoded, signature, extra] = code.split(".");
  if (!secret || !encoded || !signature || extra !== undefined) return { ok: false };
  const payload = decodeBase64Url(encoded);
  const sig = decodeBase64Url(signature);
  if (!payload || !sig) return { ok: false };
  const expected = createHmac("sha256", secret).update(payload).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return { ok: false };
  const [issuedAt, removed, nonce] = payload.toString("utf8").split(".");
  if (!issuedAt || !removed || !nonce) return { ok: false };
  if (!/^[0-9]{10,13}$/.test(issuedAt)) return { ok: false };
  if (!/^[0-9]{1,4}$/.test(removed)) return { ok: false };
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(nonce)) return { ok: false };
  return { ok: true, issuedAt: Number(issuedAt) };
}

export function metaDeletionStatus(
  code: string,
  appSecret: string,
  now = Math.floor(Date.now() / 1000),
): { ok: true; issuedAt: number } | { ok: false } {
  const status = readMetaDeletionCode(code, appSecret);
  if (!status.ok) return { ok: false };
  const age = now - status.issuedAt;
  if (age < -300 || age > 60 * 60 * 24 * 30) return { ok: false };
  return { ok: true, issuedAt: status.issuedAt };
}
