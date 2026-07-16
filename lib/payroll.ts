/**
 * คำนวณเงินเดือน + ทิป ต่องวด (โมเดลตามไฟล์ต้นแบบของร้าน):
 * - base pay: รายเดือน = monthlyAmount คงที่ / รายชั่วโมง = hourlyRate × hours
 * - ทิป: แบ่งกองทิป (tipPool) ตามสัดส่วนชั่วโมงทำงาน — คนทำมากได้มาก
 *   tip_i = hours_i / Σhours × tipPool  (ถ้า Σhours = 0 ทุกคนได้ 0)
 *
 * ทิปปัดเป็นทศนิยม 2 ตำแหน่ง แล้วยัดเศษที่ปัดหายทั้งหมดให้คนชั่วโมงมากสุด
 * เพื่อให้ผลรวมทิปเท่ากองทิปเป๊ะ (กันเงินขาด/เกินหลักสตางค์)
 */
export interface PayrollLineInput {
  userId: number;
  payType: "monthly" | "hourly";
  hours: number;
  monthlyAmount: number;
  hourlyRate: number;
}

export interface PayrollLineComputed extends PayrollLineInput {
  basePay: number;
  tipAmount: number;
  total: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computePayroll(lines: PayrollLineInput[], tipPool: number): PayrollLineComputed[] {
  const totalHours = lines.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const pool = Math.max(0, Number(tipPool) || 0);

  const out: PayrollLineComputed[] = lines.map((l) => {
    const hours = Number(l.hours) || 0;
    const basePay = l.payType === "hourly"
      ? round2((Number(l.hourlyRate) || 0) * hours)
      : round2(Number(l.monthlyAmount) || 0);
    const rawTip = totalHours > 0 ? (hours / totalHours) * pool : 0;
    return { ...l, hours, basePay, tipAmount: round2(rawTip), total: 0 };
  });

  // ยัดเศษปัดของทิปให้คนชั่วโมงมากสุด เพื่อให้ผลรวม = pool เป๊ะ
  if (totalHours > 0 && pool > 0) {
    const distributed = out.reduce((s, l) => s + l.tipAmount, 0);
    const drift = round2(pool - distributed);
    if (drift !== 0) {
      let idx = 0;
      for (let i = 1; i < out.length; i++) if (out[i].hours > out[idx].hours) idx = i;
      out[idx].tipAmount = round2(out[idx].tipAmount + drift);
    }
  }

  for (const l of out) l.total = round2(l.basePay + l.tipAmount);
  return out;
}
