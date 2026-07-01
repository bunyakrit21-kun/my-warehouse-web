import { cookies, headers } from "next/headers";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";

export interface JWTPayload {
  id: number;
  name: string;
  role: string;
  email?: string;
  type?: string;
  storeId?: number;
  storeName?: string;
  iat?: number;
  exp?: number;
}

export async function getUser(): Promise<JWTPayload | null> {
  // รองรับ mobile app ที่ส่ง Authorization: Bearer <token>
  try {
    const headerStore = await headers();
    const auth = headerStore.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    }
  } catch {
    // fallback to cookie
  }

  // fallback: เว็บใช้ httpOnly cookie ตามเดิม
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  } catch {
    return null;
  }
}

export async function resolveStoreId(
  user: JWTPayload,
  requestedStoreId?: string | null
): Promise<string | null> {
  if (user.type === "staff") return user.storeId ? String(user.storeId) : null;
  if (!requestedStoreId) return null;
  const userId = user.id;
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
