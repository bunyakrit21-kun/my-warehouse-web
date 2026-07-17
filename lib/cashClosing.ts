import sql from "@/lib/db";
import { getCurrentBusinessDate, getStoreTimeContext, getMinutesSinceMidnight } from "@/lib/businessDay";

export interface ShiftRow {
  id: number;
  name: string;
  start_time: string;
  end_time: string | null;
  color: string;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function shiftInWindow(s: ShiftRow, nowMinutes: number): boolean {
  const start = timeToMinutes(s.start_time);
  if (!s.end_time) return nowMinutes >= start;
  const end = timeToMinutes(s.end_time);
  return start <= end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
}

/** Finds which of the store's shifts the current time falls into; falls back to the nearest preceding shift. */
export async function detectCurrentShift(storeId: string, timezone: string): Promise<{ shift: ShiftRow | null; shifts: ShiftRow[] }> {
  const shifts = await sql<ShiftRow[]>`
    SELECT id, name, start_time, end_time, color FROM shifts WHERE store_id = ${storeId} ORDER BY sort_order
  `;
  if (shifts.length === 0) return { shift: null, shifts: [] };

  const nowMinutes = getMinutesSinceMidnight(new Date(), timezone);
  let shift = shifts.find(s => shiftInWindow(s, nowMinutes)) ?? null;

  if (!shift) {
    const byStart = [...shifts].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    shift = [...byStart].reverse().find(s => timeToMinutes(s.start_time) <= nowMinutes) ?? byStart[byStart.length - 1];
  }

  return { shift, shifts };
}

export interface OverdueShiftInfo {
  overdue: boolean;
  shift: ShiftRow | null;
}

/**
 * True when a shift's end_time has already passed today with no cash_closings row
 * yet for (store, shift, businessDate) — the shift ended but nobody counted the
 * drawer. Only reports the most recently ended shift, and only for same-day shifts
 * (start_time < end_time) — overnight shifts that wrap past midnight aren't covered
 * here since "has it ended" gets ambiguous across the business-date boundary; they
 * still work fine for normal shift detection/closing, just not this reminder.
 */
export async function getOverdueShiftInfo(storeId: string): Promise<OverdueShiftInfo> {
  const { timezone } = await getStoreTimeContext(storeId);
  const businessDate = await getCurrentBusinessDate(storeId);
  const nowMinutes = getMinutesSinceMidnight(new Date(), timezone);

  const shifts = await sql<ShiftRow[]>`
    SELECT id, name, start_time, end_time, color FROM shifts WHERE store_id = ${storeId} ORDER BY sort_order
  `;

  const ended = shifts
    .filter((s): s is ShiftRow & { end_time: string } => !!s.end_time && timeToMinutes(s.start_time) < timeToMinutes(s.end_time))
    .filter(s => timeToMinutes(s.end_time) <= nowMinutes)
    .sort((a, b) => timeToMinutes(a.end_time) - timeToMinutes(b.end_time));

  if (ended.length === 0) return { overdue: false, shift: null };
  const mostRecentEnded = ended[ended.length - 1];

  const [closed] = await sql`
    SELECT id FROM cash_closings
    WHERE store_id = ${storeId} AND shift_id = ${mostRecentEnded.id} AND business_date = ${businessDate}::date
  `;
  if (closed) return { overdue: false, shift: null };
  return { overdue: true, shift: mostRecentEnded };
}

export interface WithdrawalItem {
  id: number;
  amount: string;
  reason: string;
  employeeName: string | null;
  createdAt: string;
}

export interface CashClosingExpected {
  businessDate: string;
  shift: ShiftRow | null;
  shifts: ShiftRow[];
  openingFloat: number;
  withdrawals: WithdrawalItem[];
  withdrawalsTotal: number;
  /** เงินในเก๊ะประจำร้าน — จำนวนที่ต้องเหลือค้างในลิ้นชักหลังปิดร้าน */
  drawerFloat: number;
  /** กะปัจจุบันเป็นกะสุดท้ายตามเวลาที่ตั้งไว้หรือไม่ — ใช้ติ๊ก "ปิดร้าน" ให้อัตโนมัติ (พนักงานแก้ได้) */
  suggestDayClose: boolean;
  /** ที่มาของยอดรับต่อ: ใครนับไว้ กะไหน เมื่อไหร่ (null = ยังไม่เคยมีการนับ) */
  openingFrom: { closedByName: string | null; shiftName: string | null; createdAt: string } | null;
  /** true = ยอดรับต่อคือเงินในเก๊ะหลังปิดร้าน (เริ่มวันใหม่) ไม่ใช่ยอดส่งต่อจากกะ */
  openingIsNewDay: boolean;
}

/**
 * Computes everything the closing screen needs to auto-fill: opening float, and
 * withdrawals itemized since the last closing (i.e. "during this shift" without
 * needing exact shift-window timestamps).
 *
 * Opening float ทำงานเป็นรอบวัน (อิงวันเปิด-ปิดร้าน):
 * - กะระหว่างวัน: ยอดตั้งต้น = ยอดที่กะก่อนหน้านับได้ (เงินส่งต่อทั้งลิ้นชัก)
 * - หลังปิดร้าน (ปิดยอดที่ is_day_close): เงินส่วนเกินถูกเก็บออก เหลือแต่เงินในเก๊ะ
 *   → ยอดตั้งต้นของวันใหม่ = stores.drawer_float
 * - ร้านที่ยังไม่เคยปิดยอดเลย ก็เริ่มที่ drawer_float เช่นกัน
 */
export async function getCashClosingExpected(storeId: string): Promise<CashClosingExpected> {
  const { timezone } = await getStoreTimeContext(storeId);
  const businessDate = await getCurrentBusinessDate(storeId);
  const { shift, shifts } = await detectCurrentShift(storeId, timezone);

  const [store] = await sql`SELECT drawer_float FROM stores WHERE id = ${storeId}`;
  const drawerFloat = Number(store?.drawer_float ?? 0);

  const [lastClosing] = await sql`
    SELECT cc.counted_amount, cc.created_at, cc.is_day_close, cc.kept_in_drawer,
           u.name as closed_by_name, s.name as shift_name
    FROM cash_closings cc
    LEFT JOIN users u ON u.id = cc.closed_by_user_id
    LEFT JOIN shifts s ON s.id = cc.shift_id
    WHERE cc.store_id = ${storeId} ORDER BY cc.created_at DESC LIMIT 1
  `;
  const openingIsNewDay = !lastClosing || !!lastClosing.is_day_close;
  // หลังปิดร้าน: วันใหม่เปิดด้วยเงินที่ "นับแยกเหลือไว้จริง" ตอนปิด (kept_in_drawer)
  // ปิดยอดรุ่นเก่าที่ยังไม่มีค่านี้ fallback เป็นค่า drawer_float ที่ตั้งไว้
  const openingFloat = lastClosing
    ? (lastClosing.is_day_close ? Number(lastClosing.kept_in_drawer ?? drawerFloat) : Number(lastClosing.counted_amount))
    : drawerFloat;
  const openingFrom = lastClosing && !lastClosing.is_day_close
    ? { closedByName: lastClosing.closed_by_name as string | null, shiftName: lastClosing.shift_name as string | null, createdAt: String(lastClosing.created_at) }
    : null;

  // กะสุดท้ายตามเวลาที่ตั้งไว้ (เรียงตาม start_time) — ใช้เป็นค่าเริ่มต้นของช่อง "ปิดร้าน" เท่านั้น
  // ร้านที่เปิดกะไม่ครบทุกวันสามารถติ๊กเองได้ที่กะไหนก็ได้
  const lastConfigured = shifts.length > 1
    ? [...shifts].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)).at(-1)
    : null;
  const suggestDayClose = shifts.length <= 1 || !shift || lastConfigured?.id === shift.id;

  const withdrawals = await sql<WithdrawalItem[]>`
    SELECT cw.id, cw.amount, cw.reason, cw.created_at as "createdAt",
           u.name as "employeeName"
    FROM cash_withdrawals cw
    LEFT JOIN users u ON u.id = cw.user_id
    WHERE cw.store_id = ${storeId} AND cw.business_date = ${businessDate}::date
    ${lastClosing ? sql`AND cw.created_at > ${lastClosing.created_at}` : sql``}
    ORDER BY cw.created_at ASC
  `;

  const withdrawalsTotal = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);

  return { businessDate, shift, shifts, openingFloat, withdrawals, withdrawalsTotal, drawerFloat, suggestDayClose, openingFrom, openingIsNewDay };
}

export interface UnclosedDay {
  businessDate: string;
  hasPartialClose: boolean; // มีการปิดกะระหว่างวันแต่ยังไม่ปิดร้าน
}

/**
 * วัน "ค้างปิดยอด": วันทำการในอดีต (ก่อนวันทำการปัจจุบัน) ที่มีความเคลื่อนไหว
 * (ขาย/เบิก/ปิดกะ) แต่ยังไม่มีการปิดร้าน (is_day_close) และเจ้าของยังไม่ได้
 * ทำเครื่องหมายว่าเป็นวันหยุด/ร้านปิด — เรียงจากเก่าสุดไปใหม่สุด
 *
 * ใช้บล็อกไม่ให้ทำรายการวันใหม่จนกว่าเจ้าของจะเคลียร์ (ปิดย้อนหลัง หรือทำเครื่องหมายวันหยุด)
 */
export async function getUnclosedDays(storeId: string): Promise<UnclosedDay[]> {
  const businessDate = await getCurrentBusinessDate(storeId);
  const rows = await sql<{ business_date: string; has_partial: boolean }[]>`
    WITH activity AS (
      -- เฉพาะวันที่มีเงินสดเคลื่อนไหวจริง (ปิดกะ/เบิกเงิน) — รับของเข้าสต็อกอย่างเดียวไม่ถือเป็นวันต้องปิดยอด
      SELECT business_date FROM cash_withdrawals WHERE store_id = ${storeId}
      UNION SELECT business_date FROM cash_closings WHERE store_id = ${storeId}
    )
    SELECT DISTINCT a.business_date::text AS business_date,
      EXISTS (SELECT 1 FROM cash_closings c WHERE c.store_id = ${storeId} AND c.business_date = a.business_date) AS has_partial
    FROM activity a
    WHERE a.business_date < ${businessDate}::date
      AND NOT EXISTS (
        SELECT 1 FROM cash_closings c
        WHERE c.store_id = ${storeId} AND c.business_date = a.business_date AND c.is_day_close = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM store_closed_days d
        WHERE d.store_id = ${storeId} AND d.business_date = a.business_date
      )
    ORDER BY business_date ASC
  `;
  return rows.map(r => ({ businessDate: r.business_date, hasPartialClose: r.has_partial }));
}
