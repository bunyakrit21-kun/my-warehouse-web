import { NextResponse } from "next/server";

// บังคับให้เป็น Dynamic เพื่อไม่ให้ Next.js ตรวจสอบตอน Build
export const dynamic = "force-dynamic";

export async function POST() {
  // บล็อกระบบบอทไว้ชั่วคราว เพื่อให้โฟกัสที่ตัวเว็บหลักก่อน
  return NextResponse.json(
    { message: "LINE Bot is temporarily disabled for web development." },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({ status: "Webhook placeholder active" });
}