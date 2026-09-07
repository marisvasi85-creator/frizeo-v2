import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAuthCookieOptions } from "@/lib/supabase/cookieOptions";
import { getFrizeoAppUrl, isEmailHost } from "@/lib/frizeo-email/config";
import { isPlatformAdminEmail } from "@/lib/auth/requirePlatformAdmin";
import {
  emailHostPathAction,
  isPublicEmailPath,
  isSecretAuthenticatedApiPath,
  needsSessionLookup,
} from "@/lib/proxy/emailHostRouting";

function rewriteEmailHostPath(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host");
  if (!isEmailHost(host)) return null;

  const decision = emailHostPathAction(req.nextUrl.pathname);
  if (decision.action === "passthrough") return null;

  const url = req.nextUrl.clone();
  url.pathname = decision.pathname;
  if (decision.action === "redirect") {
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.rewrite(url);
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Cron / webhooks / internal workers auth with secrets, not cookies.
  // Must not 307 to /login when cron-job.org hits email.frizeo.ro/api/internal/*.
  if (isSecretAuthenticatedApiPath(pathname)) {
    return NextResponse.next();
  }

  const emailRewrite = rewriteEmailHostPath(req);
  const res = emailRewrite ?? NextResponse.next();

  const host = req.headers.get("host");
  const onEmailHost = isEmailHost(host);

  if (!needsSessionLookup(pathname, onEmailHost)) {
    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getAuthCookieOptions(),
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Frizeo Email gate (skip public unsubscribe + SSO exchange).
  const onEmailApp =
    onEmailHost ||
    pathname === "/email" ||
    pathname.startsWith("/email/") ||
    pathname.startsWith("/api/email");

  if (onEmailApp && !isPublicEmailPath(pathname)) {
    const frizeoUrl = getFrizeoAppUrl();

    if (!user) {
      const login = new URL("/login", frizeoUrl);
      login.searchParams.set(
        "next",
        onEmailHost ? `https://${host?.split(":")[0]}/` : "/email",
      );
      return NextResponse.redirect(login);
    }

    if (!isPlatformAdminEmail(user.email)) {
      return NextResponse.redirect(new URL("/admin/dashboard", frizeoUrl));
    }
  }

  return res;
}

/**
 * www / staging / preview: only gated surfaces.
 * email.frizeo.ro: keep a broad matcher so /contacts, /campaigns, / etc.
 * still rewrite into /email/*. Cron/internal/webhooks stay out of this
 * catch-all so they never hit the email login gate.
 */
const emailHostCatchAll = {
  source:
    "/((?!_next/static|_next/image|monitoring|api/cron|api/internal|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|js|map|woff2?|ttf)$).*)",
  has: [{ type: "host" as const, value: "email.frizeo.ro" }],
};

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/email",
    "/email/:path*",
    "/api/email/:path*",
    emailHostCatchAll,
    { ...emailHostCatchAll, has: [{ type: "host" as const, value: "email.localhost" }] },
    { ...emailHostCatchAll, has: [{ type: "host" as const, value: "email.local" }] },
  ],
};
