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
}

/**
 * Computes everything the closing screen needs to auto-fill: opening float (carried
 * from the last closing, per spec-04 step 6), and withdrawals itemized since that last
 * closing (i.e. "during this shift" without needing exact shift-window timestamps).
 */
export async function getCashClosingExpected(storeId: string): Promise<CashClosingExpected> {
  const { timezone } = await getStoreTimeContext(storeId);
  const businessDate = await getCurrentBusinessDate(storeId);
  const { shift, shifts } = await detectCurrentShift(storeId, timezone);

  const [lastClosing] = await sql`
    SELECT counted_amount, created_at FROM cash_closings
    WHERE store_id = ${storeId} ORDER BY created_at DESC LIMIT 1
  `;
  const openingFloat = lastClosing ? Number(lastClosing.counted_amount) : 0;

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

  return { businessDate, shift, shifts, openingFloat, withdrawals, withdrawalsTotal };
}
