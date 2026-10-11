import { createHmac } from "node:crypto";
import { META_GRAPH_VERSION } from "@/lib/integrations/meta/config";

const GRAPH_ORIGIN = "https://graph.facebook.com";
const PATH_RE = /^[0-9]{1,32}(?:\/(?:photos|media|media_publish))?$/;

export type GraphCall = {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  form?: Record<string, string>;
  token: string;
  timeoutMs: number;
  appSecret: string;
};

export type GraphResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; status: number; body: unknown }
  | { ok: false; timeout: true };

export function buildGraphUrl(
  path: string,
  query: Record<string, string>,
  version = META_GRAPH_VERSION,
): string {
  if (!PATH_RE.test(path)) throw new Error("graph_path");
  if (path.startsWith("/") || path.includes("..") || path.includes("?")) {
    throw new Error("graph_path");
  }
  for (const key of Object.keys(query)) {
    if (key === "access_token" || key === "fb_exchange_token") throw new Error("graph_path");
  }
  const url = new URL(`${GRAPH_ORIGIN}/${version}/${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  if (url.searchParams.has("access_token") || url.searchParams.has("fb_exchange_token")) {
    throw new Error("graph_path");
  }
  if (url.origin !== GRAPH_ORIGIN) throw new Error("graph_path");
  return url.toString();
}

export function graphErrorCode(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: { code?: unknown } }).error;
  if (!error || typeof error !== "object") return null;
  return typeof error.code === "number" ? error.code : null;
}

export function createMetaPublishHttp(fetchImpl: typeof fetch = fetch) {
  return async (call: GraphCall): Promise<GraphResult> => {
    try {
      const proof = createHmac("sha256", call.appSecret).update(call.token).digest("hex");
      const query = { ...call.query, appsecret_proof: proof };
      const url = buildGraphUrl(call.path, query);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${call.token}`,
      };
      let body: string | undefined;
      if (call.method === "POST") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        const form = call.form ?? {};
        if ("access_token" in form || "fb_exchange_token" in form) {
          return { ok: false, status: 0, body: null };
        }
        body = new URLSearchParams(form).toString();
      }
      const response = await fetchImpl(url, {
        method: call.method,
        headers,
        body,
        signal: AbortSignal.timeout(call.timeoutMs),
        cache: "no-store",
      });
      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text) as unknown;
        } catch {
          parsed = null;
        }
      }
      if (!response.ok) return { ok: false, status: response.status, body: parsed };
      return { ok: true, status: response.status, body: parsed };
    } catch {
      return { ok: false, timeout: true };
    }
  };
}
