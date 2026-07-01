import { cookies, headers } from "next/headers";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";

export async function getUser() {
  // รองรับ mobile app ที่ส่ง Authorization: Bearer <token>
  try {
    const headerStore = await headers();
    const auth = headerStore.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      return jwt.verify(token, process.env.JWT_SECRET!) as any;
    }
  } catch {
    // ถ้า header ไม่มีหรือ token ไม่ valid ให้ตกไปเช็ค cookie
  }

  // fallback: เว็บใช้ httpOnly cookie ตามเดิม
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as any;
  } catch {
    return null;
  }
}

export async function resolveStoreId(
  user: { id?: number; type?: string; storeId?: number },
  requestedStoreId?: string | null
): Promise<string | null> {
  if (user.type === "staff") return user.storeId ? String(user.storeId) : null;
  if (!requestedStoreId) return null;
  const userId = user.id ?? 0;
  const rows = await sql`
    SELECT id FROM stores
    WHERE id = ${requestedStoreId}
    AND (
      owner_id = ${userId}
      OR id IN (SELECT store_id FROM store_members WHERE user_id = ${userId})
    )
  `;
  return rows.length > 0 ? requestedStoreId : null;
}
