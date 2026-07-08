import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId, hasValidStepUp } from "@/lib/auth";

const VALID_TYPES = ["cash", "bank", "e-wallet", "other"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  if (!(await hasValidStepUp(user.id))) {
    return NextResponse.json({ error: "กรุณายืนยันรหัสผ่านที่หน้าบัญชีก่อนแก้ไขข้อมูล" }, { status: 403 });
  }

  try {
    const [existing] = await sql`SELECT store_id, is_system FROM accounts WHERE id = ${id} AND archived_at IS NULL`;
    if (!existing) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });

    const { name, icon, accountType } = await request.json();
    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อบัญชี" }, { status: 400 });
    // The system-created default cash account keeps its type (cash) fixed — only
    // its name/icon are cosmetic and safe to change.
    if (accountType && !existing.is_system && !VALID_TYPES.includes(accountType)) {
      return NextResponse.json({ error: "ประเภทบัญชีไม่ถูกต้อง" }, { status: 400 });
    }

    if (accountType && !existing.is_system) {
      await sql`UPDATE accounts SET name = ${name}, icon = ${icon ?? null}, account_type = ${accountType} WHERE id = ${id}`;
    } else {
      await sql`UPDATE accounts SET name = ${name}, icon = ${icon ?? null} WHERE id = ${id}`;
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// DELETE = archive (soft delete). Refuses to archive the system default-cash account.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  if (!(await hasValidStepUp(user.id))) {
    return NextResponse.json({ error: "กรุณายืนยันรหัสผ่านที่หน้าบัญชีก่อนแก้ไขข้อมูล" }, { status: 403 });
  }

  try {
    const [existing] = await sql`SELECT store_id, is_default_cash, is_system FROM accounts WHERE id = ${id} AND archived_at IS NULL`;
    if (!existing) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });

    if (existing.is_default_cash || existing.is_system) {
      return NextResponse.json({ error: "ไม่สามารถลบบัญชีเงินสดหลักได้ ต้องมีอย่างน้อย 1 บัญชีเสมอ" }, { status: 400 });
    }

    await sql`UPDATE accounts SET archived_at = now() WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
