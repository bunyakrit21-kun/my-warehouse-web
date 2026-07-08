import type postgres from "postgres";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import type { JWTPayload } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";

type SqlClient = postgres.TransactionSql<Record<string, unknown>>;

/**
 * นโยบายแก้ไขย้อนหลัง (ใช้เหมือนกันทุกระบบ):
 * - แก้/ลบได้ภายใน EDIT_WINDOW_DAYS วันนับจากตอนบันทึก
 * - ต้องเป็น admin/manager และยืนยันรหัสผ่านหลัก (รหัส login) สดทุกครั้ง
 * - ทุกการแก้ถูกบันทึกลง record_edits (ใคร แก้อะไร จากอะไรเป็นอะไร เมื่อไหร่)
 */
export const EDIT_WINDOW_DAYS = 7;

export function isWithinEditWindow(createdAt: string | Date): boolean {
  return Date.now() - new Date(createdAt).getTime() <= EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export const EDIT_WINDOW_ERROR = `รายการเกิน ${EDIT_WINDOW_DAYS} วันแล้ว แก้ไขย้อนหลังไม่ได้`;

export type MasterPasswordResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Verifies the caller's own login password ("รหัสหลัก") before a retroactive
 * edit/delete. Rate-limited per user so this can't be used to brute-force the
 * password from an existing session.
 */
export async function verifyMasterPassword(user: JWTPayload, password: unknown): Promise<MasterPasswordResult> {
  if (user.role !== "admin" && user.role !== "manager") {
    return { ok: false, status: 403, error: "ไม่มีสิทธิ์แก้ไขย้อนหลัง" };
  }
  if (!password || typeof password !== "string") {
    return { ok: false, status: 400, error: "กรุณายืนยันรหัสผ่านหลักก่อนแก้ไข" };
  }
  if (isRateLimited(`record-edit-auth:${user.id}`, 5, 5 * 60 * 1000)) {
    return { ok: false, status: 429, error: "ลองยืนยันตัวตนผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีกสักครู่" };
  }

  const [row] = await sql`SELECT password FROM users WHERE id = ${user.id} AND active = true`;
  if (!row) return { ok: false, status: 404, error: "ไม่พบบัญชีผู้ใช้" };
  if (!row.password) {
    return { ok: false, status: 403, error: "บัญชีนี้เข้าระบบด้วย PIN ไม่มีรหัสผ่านหลัก — ให้เจ้าของร้านเป็นผู้แก้ไข" };
  }

  const isMatch = await bcrypt.compare(password, row.password);
  if (!isMatch) return { ok: false, status: 401, error: "รหัสผ่านไม่ถูกต้อง" };
  return { ok: true };
}

export interface RecordEditLog {
  storeId: number | string;
  recordType: "movement" | "cash_withdrawal" | "transaction" | "cash_closing";
  recordId: number | string;
  action: "edit" | "delete";
  editedBy: number;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

/** Writes one audit row; call inside the same transaction as the edit itself. */
export async function logRecordEdit(tx: SqlClient, log: RecordEditLog): Promise<void> {
  // postgres.js's JSONValue type doesn't structurally match Record<string, unknown>; plain JSON at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldJson = log.oldValues ? tx.json(log.oldValues as any) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newJson = log.newValues ? tx.json(log.newValues as any) : null;
  await tx`
    INSERT INTO record_edits (store_id, record_type, record_id, action, edited_by, old_values, new_values)
    VALUES (${log.storeId}, ${log.recordType}, ${log.recordId}, ${log.action}, ${log.editedBy}, ${oldJson}, ${newJson})
  `;
}
