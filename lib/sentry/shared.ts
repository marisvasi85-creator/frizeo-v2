import type { ErrorEvent } from "@sentry/nextjs";
import type { HttpBodyCollectionTarget } from "@sentry/core";

const SENSITIVE_QUERY_KEYS = [
  "token",
  "secret",
  "code",
  "email",
  "phone",
  "password",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "authorization",
] as const;

const SENSITIVE_QUERY_KEY_SET = new Set<string>(SENSITIVE_QUERY_KEYS);

function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url, "http://localhost");
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEY_SET.has(key.toLowerCase())) {
        parsed.searchParams.set(key, "[Filtered]");
      }
    }
    if (!/^https?:\/\//i.test(url)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
    delete event.user.name;
  }

  if (event.request) {
    if (event.request.cookies) {
      event.request.cookies = {};
    }
    if (event.request.headers) {
      const headers = { ...event.request.headers };
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        if (
          lower === "authorization" ||
          lower === "cookie" ||
          lower === "set-cookie" ||
          lower.includes("api-key") ||
          lower.includes("secret") ||
          lower.includes("token")
        ) {
          headers[key] = "[Filtered]";
        }
      }
      event.request.headers = headers;
    }
    if (event.request.query_string) {
      if (typeof event.request.query_string === "string") {
        event.request.query_string =
          scrubUrl(`http://x?${event.request.query_string}`)?.split("?")[1] ??
          "[Filtered]";
      } else if (Array.isArray(event.request.query_string)) {
        event.request.query_string = event.request.query_string.map(
          ([k, v]): [string, string] =>
            SENSITIVE_QUERY_KEY_SET.has(String(k).toLowerCase())
              ? [k, "[Filtered]"]
              : [k, v],
        );
      } else {
        const qs = { ...event.request.query_string };
        for (const key of Object.keys(qs)) {
          if (SENSITIVE_QUERY_KEY_SET.has(key.toLowerCase())) {
            qs[key] = "[Filtered]";
          }
        }
        event.request.query_string = qs;
      }
    }
    if (event.request.url) {
      event.request.url = scrubUrl(event.request.url);
    }
    delete event.request.data;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      if (crumb.data && typeof crumb.data === "object") {
        const data = { ...crumb.data } as Record<string, unknown>;
        for (const key of Object.keys(data)) {
          const lower = key.toLowerCase();
          if (
            SENSITIVE_QUERY_KEY_SET.has(lower) ||
            lower.includes("email") ||
            lower.includes("phone") ||
            lower.includes("password") ||
            lower.includes("token") ||
            lower.includes("secret")
          ) {
            data[key] = "[Filtered]";
          }
        }
        return { ...crumb, data };
      }
      return crumb;
    });
  }

  return event;
}

export function getSentryDsn(): string | undefined {
  const serverDsn = process.env.SENTRY_DSN?.trim();
  const publicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (typeof window === "undefined") {
    return serverDsn || publicDsn || undefined;
  }
  return publicDsn || undefined;
}

export function getSentryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    "development"
  );
}

/** Conservative traces sampling for Sentry Free quota. */
export function getTracesSampleRate(): number {
  if (process.env.NODE_ENV !== "production") return 0.1;
  const env = getSentryEnvironment();
  if (env === "preview" || env === "staging") return 0.05;
  return 0.02;
}

export function getSharedSentryOptions() {
  const dsn = getSentryDsn();
  const httpBodies: HttpBodyCollectionTarget[] = [];

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: getSentryEnvironment(),
    tracesSampleRate: getTracesSampleRate(),
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpBodies,
      httpHeaders: {
        request: {
          deny: [
            "authorization",
            "cookie",
            "set-cookie",
            "x-api-key",
            "x-supabase-auth",
          ],
        },
        response: {
          deny: ["set-cookie", "authorization"],
        },
      },
      urlQueryParams: {
        deny: [...SENSITIVE_QUERY_KEYS],
      },
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    },
    beforeSend(event: ErrorEvent) {
      return scrubEvent(event);
    },
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection captured",
      /^NetworkError/,
      /^AbortError/,
      /Loading chunk [\d]+ failed/,
    ],
  };
}
