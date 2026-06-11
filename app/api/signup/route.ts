import { NextResponse } from "next/server";
import { createSessionToken, sessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    if (!name || !email || !password) {
      return new NextResponse("กรุณากรอกข้อมูลให้ครบถ้วน", { status: 400 });
    }

    // DEMO: ยังไม่บันทึกลง DB

    // ✅ สำคัญ: ต้อง await
    const token = await createSessionToken({ email, name });

    const res = NextResponse.redirect(new URL("/main", request.url));
    res.cookies.set(sessionCookie.name, token, sessionCookie.options);

    return res;
  } catch (error) {
    console.error("Signup Error:", error);
    return new NextResponse("เกิดข้อผิดพลาดทางเทคนิค", { status: 500 });
  }
}