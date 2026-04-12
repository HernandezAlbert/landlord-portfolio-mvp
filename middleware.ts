import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ allow public + cron routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") || 
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/login")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("lp_session")?.value;
  if (!token) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};