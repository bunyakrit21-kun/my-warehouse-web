import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "diam_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ป้องกันเฉพาะ /main
  const isProtected = pathname === "/main" || pathname.startsWith("/main/");

  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/main/:path*"],
};