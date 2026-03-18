import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  // 🔐 Protejăm /admin
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 🔐 Protejăm /select-tenant
  if (pathname.startsWith("/select-tenant")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 🔐 Blocăm acces la login dacă e deja logat
  if (pathname.startsWith("/login") && user) {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/select-tenant"],
};