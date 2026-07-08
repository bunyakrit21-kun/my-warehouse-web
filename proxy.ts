import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// CORS: อนุญาตเฉพาะ origin ใน env CORS_ALLOWED_ORIGINS (คั่นด้วย comma) เท่านั้น
// - เว็บปกติเรียก API จาก origin เดียวกัน → ไม่ต้องใช้ CORS อยู่แล้ว
// - แอป native (iOS/Android) ไม่บังคับ CORS → ไม่ต้องตั้งค่า
// - ถ้ามี webview/เว็บ origin อื่นต้องเรียก API ให้เพิ่ม origin นั้นใน env
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeadersFor(origin: string | null): Record<string, string> | null {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const corsHeaders = corsHeadersFor(request.headers.get("origin"));

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders ?? undefined });
  }

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    if (corsHeaders) {
      Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    }
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
        // ผู้จัดการเข้าได้ทุกหน้า ยกเว้น /dashboard/stores และ /dashboard/accounting (เจ้าของร้าน/admin เท่านั้น)
        if (pathname.startsWith("/dashboard/stores") || pathname.startsWith("/dashboard/accounting")) {
          return NextResponse.redirect(new URL("/dashboard/movement", request.url));
        }
      } else {
        // พนักงานทั่วไป → movement + fresh-check เท่านั้น (ประวัติปิดยอดเป็นของผู้จัดการ/แอดมิน)
        const staffAllowed = ["/dashboard/movement", "/dashboard/fresh-check", "/dashboard/cash-closing"];
        const isManagerOnly = pathname.startsWith("/dashboard/cash-closing/history");
        if (isManagerOnly || !staffAllowed.some(p => pathname.startsWith(p))) {
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
