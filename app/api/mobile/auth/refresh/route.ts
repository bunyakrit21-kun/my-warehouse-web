import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// รับ token เดิม (ยังไม่หมดอายุ) แล้วออก token ใหม่อายุ 7 วัน
// แอปควรเรียกก่อน token หมด หรือเมื่อได้รับ 401 จาก endpoint อื่น
export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "กรุณาส่ง token" }, { status: 400 });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err: any) {
      const expired = err?.name === "TokenExpiredError";
      return NextResponse.json(
        { error: expired ? "token หมดอายุแล้ว กรุณา login ใหม่" : "token ไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // ลบ jwt meta fields ออก แล้วออก token ใหม่
    const { iat, exp, ...claims } = payload;
    const newToken = jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn: "7d" });

    return NextResponse.json({ token: newToken });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
