import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // เพิ่ม CORS headers ให้ทุก API response
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    if (payload.type === "staff") {
      if (payload.role === "manager") {
        // ผู้จัดการเข้าได้ทุกหน้า ยกเว้น /dashboard/stores (admin only)
        if (pathname.startsWith("/dashboard/stores")) {
          return NextResponse.redirect(new URL("/dashboard/movement", request.url));
        }
      } else {
        // พนักงานทั่วไป → movement + fresh-check เท่านั้น
        const staffAllowed = ["/dashboard/movement", "/dashboard/fresh-check", "/dashboard/cash-closing"];
        if (!staffAllowed.some(p => pathname.startsWith(p))) {
          return NextResponse.redirect(new URL("/dashboard/movement", request.url));
        }
      }
    }

    if (pathname.startsWith("/dashboard/stores") && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};