import { NextResponse } from "next/server";
import { createSessionToken, sessionCookie } from "@/lib/session";

const USERS = [
  { email: "admin@diam.com", password: "1234", name: "DiaM Admin" },
  { email: "staff@diam.com", password: "5678", name: "Warehouse Staff" },
  { email: "boss@diam.com", password: "9999", name: "Owner" },
];

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  const user = USERS.find((u) => u.email === email && u.password === password);
  if (!user) return new NextResponse("Invalid credentials", { status: 401 });

  const token = await createSessionToken({ email: user.email, name: user.name });

  // ✅ สำคัญ: ใช้ 303 เพื่อให้ redirect ไป /main ด้วย GET
  const res = NextResponse.redirect(new URL("/main", request.url), { status: 303 });

  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
}