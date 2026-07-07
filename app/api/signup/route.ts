import { NextResponse } from "next/server";
import sql from "@/lib/db";
import bcrypt from "bcryptjs";
import { DEFAULT_COUNTRY_CODE, isValidCountryCode } from "@/lib/countries";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { createThumbnail } from "@/lib/image-thumbnail";

const MAX_SIGNUPS_PER_IP = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const VALID_LANGUAGES = ["th", "en", "zh-TW", "vi"];
const DEFAULT_LANGUAGE = "th";
const DEFAULT_EXPENSE_CATEGORIES = ["ค่าเช่า", "ค่าน้ำค่าไฟ", "เงินเดือนพนักงาน", "ค่าวัตถุดิบ", "อื่นๆ"];

export async function POST(request: Request) {
  try {
    if (isRateLimited(`signup:${getClientIp(request)}`, MAX_SIGNUPS_PER_IP, SIGNUP_WINDOW_MS)) {
      return NextResponse.json({ error: "มีการสมัครจาก IP นี้บ่อยเกินไป กรุณาลองใหม่ภายหลัง" }, { status: 429 });
    }

    const {
      name, email, password, storeName, businessType, phone,
      businessDayStartTime, businessDayEndTime, country, language, logo,
    } = await request.json();

    if (!name || !email || !password || !storeName || !businessType || !phone) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" }, { status: 400 });
    }

    const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
    const startTime = TIME_RE.test(businessDayStartTime) ? businessDayStartTime : "00:00";
    const endTime = TIME_RE.test(businessDayEndTime) ? businessDayEndTime : "00:00";
    const storeCountry = isValidCountryCode(country) ? country : DEFAULT_COUNTRY_CODE;
    const storeLanguage = VALID_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;

    if (password.length < 8 || !/\d/.test(password)) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษรและมีตัวเลขอย่างน้อย 1 ตัว" }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const logoThumbnail = logo ? await createThumbnail(logo) : null;

    // สร้าง user และ store พร้อมกัน
    const result = await sql.begin(async (sql) => {
      const [user] = await sql`
        INSERT INTO users (name, email, password, role, active)
        VALUES (${name}, ${email}, ${hashedPassword}, 'admin', true)
        RETURNING id, name, email, role
      `;

      const [store] = await sql`
        INSERT INTO stores (
          owner_id, name, business_type, phone, business_day_start_time, business_day_end_time,
          country, default_language, logo, logo_thumbnail
        )
        VALUES (
          ${user.id}, ${storeName}, ${businessType}, ${phone}, ${startTime}, ${endTime},
          ${storeCountry}, ${storeLanguage}, ${logo ?? null}, ${logoThumbnail}
        )
        RETURNING id, name
      `;

      // บัญชี "เงินสด" เริ่มต้น + หมวดหมู่ระบบ ให้ระบบบัญชี (spec-07) มีที่ผูกได้ตั้งแต่วันแรก
      await sql`
        INSERT INTO accounts (store_id, name, account_type, is_default_cash)
        VALUES (${store.id}, 'เงินสด', 'cash', true)
      `;
      await sql`
        INSERT INTO transaction_categories (store_id, name, type, is_system)
        VALUES (${store.id}, 'ยอดขายประจำวัน', 'income', true)
      `;
      for (const catName of DEFAULT_EXPENSE_CATEGORIES) {
        await sql`
          INSERT INTO transaction_categories (store_id, name, type, is_system)
          VALUES (${store.id}, ${catName}, 'expense', true)
        `;
      }

      return { user, store };
    });

    // ไม่ auto-login หลังสมัคร — บังคับให้ login รอบแรกด้วยรหัสผ่านที่เพิ่งตั้งเอง
    return NextResponse.json({ success: true, storeId: result.store.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}