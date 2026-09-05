import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAuthCookieOptions } from "@/lib/supabase/cookieOptions";
import { getFrizeoAppUrl, isEmailHost } from "@/lib/frizeo-email/config";
import { isPlatformAdminEmail } from "@/lib/auth/requirePlatformAdmin";
import {
  isPublicEmailPath,
  isSecretAuthenticatedApiPath,
} from "@/lib/frizeo-email/publicEmailPaths";

function rewriteEmailHostPath(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host");
  if (!isEmailHost(host)) return null;

  const { pathname } = req.nextUrl;

  // Canonicalize /email/* → /* on the email subdomain.
  if (pathname === "/email" || pathname.startsWith("/email/")) {
    const url = req.nextUrl.clone();
    const stripped = pathname.slice("/email".length) || "/";
    url.pathname = stripped;
    return NextResponse.redirect(url, 308);
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return null;
  }

  // Map public unsubscribe + app paths → /email/*
  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/email" : `/email${pathname}`;
  return NextResponse.rewrite(url);
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Cron / webhooks / internal workers auth with secrets, not cookies.
  // Skip the email login gate and the extra getUser() round-trip so a
  // request to email.frizeo.ro/api/internal/marketing/* is not 307'd to /login.
  if (isSecretAuthenticatedApiPath(pathname)) {
    return NextResponse.next();
  }

  const emailRewrite = rewriteEmailHostPath(req);
  const res = emailRewrite ?? NextResponse.next();

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

  const host = req.headers.get("host");
  const onEmailHost = isEmailHost(host);
  const onEmailApp =
    onEmailHost ||
    pathname.startsWith("/email") ||
    pathname.startsWith("/api/email");

  if (!user && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Frizeo Email gate (skip public unsubscribe + SSO exchange).
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

export const config = {
  matcher: [
    "/admin/:path*",
    "/email",
    "/email/:path*",
    "/api/email/:path*",
    "/unsubscribe",
    "/unsubscribe/:path*",
    /*
     * Broad matcher so email.frizeo.ro root paths (/contacts, etc.) are rewritten.
     * Skips Next internals / common static files.
     */
    "/((?!_next/static|_next/image|monitoring|api/cron|api/internal|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
