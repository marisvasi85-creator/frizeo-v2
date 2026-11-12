import { createHash, randomBytes } from "node:crypto";

export const TIKTOK_MEDIA_ORIGIN = "https://staging.frizeo.ro";
export const TIKTOK_MEDIA_TTL_MS = 15 * 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const OBJECT_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

export function createMediaToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashMediaToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseMediaToken(param: string): string | null {
  const token = param.endsWith(".jpg") ? param.slice(0, -4) : "";
  return TOKEN_RE.test(token) ? token : null;
}

export function mediaObjectPath(tenantId: string, objectPath: string): string | null {
  const tenant = tenantId.trim().toLowerCase();
  const path = objectPath.trim().toLowerCase();
  if (!OBJECT_PATH_RE.test(path) || !path.startsWith(`${tenant}/`)) return null;
  return path;
}

export function draftImageUrl(token: string): string | null {
  if (!TOKEN_RE.test(token)) return null;
  return `${TIKTOK_MEDIA_ORIGIN}/api/integrations/tiktok/media/${token}.jpg`;
}

export function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export type MediaGrant = {
  tenantId: string;
  objectPath: string;
  expiresAt: string;
};

export async function serveTikTokDraftImage(input: {
  tokenParam: string;
  production: boolean;
  stagingHost: boolean;
  now: Date;
  readGrant: (tokenHash: string) => Promise<MediaGrant | null>;
  readObject: (objectPath: string) => Promise<Buffer | null>;
}): Promise<{ status: 200; body: Buffer } | { status: 404 }> {
  if (input.production || !input.stagingHost) return { status: 404 };
  const token = parseMediaToken(input.tokenParam);
  if (!token) return { status: 404 };
  const grant = await input.readGrant(hashMediaToken(token));
  if (!grant) return { status: 404 };
  if (new Date(grant.expiresAt).getTime() <= input.now.getTime()) return { status: 404 };
  const path = mediaObjectPath(grant.tenantId, grant.objectPath);
  if (!path) return { status: 404 };
  const bytes = await input.readObject(path);
  if (!bytes || bytes.length === 0 || bytes.length > 8_388_608 || !isJpeg(bytes)) {
    return { status: 404 };
  }
  return { status: 200, body: bytes };
}
