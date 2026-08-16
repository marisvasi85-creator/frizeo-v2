import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function supabaseHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseHostname();

const requiredEnvironmentVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name],
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Lipsesc variabile obligatorii: ${missingEnvironmentVariables.join(", ")}`,
  );
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : [
            {
              protocol: "https" as const,
              hostname: "*.supabase.co",
              pathname: "/storage/v1/object/public/**",
            },
          ]),
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "frizeo.ro" }],
        destination: "https://www.frizeo.ro/:path*",
        permanent: true,
      },
      {
        source: "/barbers",
        destination: "/frizerii",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
const sentryOrg = process.env.SENTRY_ORG?.trim();
const sentryProject = process.env.SENTRY_PROJECT?.trim();
const sentrySourceMapsEnabled = Boolean(
  sentryAuthToken && sentryOrg && sentryProject,
);

export default withSentryConfig(nextConfig, {
  org: sentryOrg,
  project: sentryProject,
  authToken: sentryAuthToken,
  silent: !process.env.CI,
  // Do not send Sentry build-plugin telemetry.
  telemetry: false,
  // Better client stack traces when source maps upload is enabled.
  widenClientFileUpload: true,
  // Avoid failing CI/local builds when source-map credentials are absent.
  sourcemaps: {
    disable: !sentrySourceMapsEnabled,
    deleteSourcemapsAfterUpload: true,
  },
  errorHandler: (err) => {
    console.warn("[sentry] build plugin warning:", err.message);
  },
  // Tunnel helps client events past ad blockers; keep a fixed path.
  tunnelRoute: "/monitoring",
  // No Vercel Cron monitor auto-create (unused / Free plan).
  webpack: {
    automaticVercelMonitors: false,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
