/**
 * Seed script — ร้านอาหารไทย "ครัวคุณแม่" ข้อมูลลูกค้า 1 เดือน
 *
 * Usage: node scripts/seed.mjs
 *
 * Login หลังรัน:
 *   Admin  → email: kruamae@diam.demo  | password: demo1234
 *   Staff  → ชื่อร้าน: ครัวคุณแม่     | PIN: 1111 / 2222 / 3333
 */

import postgres from "postgres";
import bcrypt from "bcryptjs";

const DB_URL =
  "postgresql://postgres.vhvacguzmipgohhyxuyr:xycdeM-8doqxu-bekjup@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

const sql = postgres(DB_URL, { ssl: "require" });

// ─── helpers ────────────────────────────────────────────────────────────────

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

function daysAgo(days, hourMin = 7, hourMax = 21) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(rand(hourMin, hourMax), rand(0, 59), rand(0, 59), 0);
  return d;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 เริ่ม seed ข้อมูลตัวอย่าง...\n");

  // ── 1. ตรวจสอบว่ามีข้อมูลอยู่แล้วไหม ──────────────────────────────────
  const existing = await sql`SELECT id FROM users WHERE email = 'kruamae@diam.demo'`;
  if (existing.length > 0) {
    console.log("⚠️  พบข้อมูล seed อยู่แล้ว (kruamae@diam.demo) — ข้ามการสร้างซ้ำ");
    console.log("   ถ้าต้องการรันใหม่ ให้ลบ user นี้ออกก่อน");
    await sql.end();
    return;
  }

  // ── 2. Admin user ───────────────────────────────────────────────────────
  const hashedPw = await bcrypt.hash("demo1234", 10);
  const [owner] = await sql`
    INSERT INTO users (name, email, password, role, active)
    VALUES ('สมชาย ใจดี', 'kruamae@diam.demo', ${hashedPw}, 'admin', true)
    RETURNING id
  `;
  console.log(`✅ สร้าง admin: สมชาย ใจดี (id=${owner.id})`);

  // ── 3. Store ────────────────────────────────────────────────────────────
  const [store] = await sql`
    INSERT INTO stores (owner_id, name, business_type, phone, active)
    VALUES (${owner.id}, 'ครัวคุณแม่', 'ร้านอาหารไทย', '0812345678', true)
    RETURNING id
  `;
  console.log(`✅ สร้างร้าน: ครัวคุณแม่ (id=${store.id})`);

  // ── 4. Staff (3 คน) ────────────────────────────────────────────────────
  const staffData = [
    { name: "สมหญิง ขยันดี",  pin: "1111", role: "staff"   },
    { name: "วิชัย มีสุข",    pin: "2222", role: "staff"   },
    { name: "นภา สดใส",       pin: "3333", role: "manager" },
  ];

  const staffUsers = [];
  for (const s of staffData) {
    const [u] = await sql`
      INSERT INTO users (name, role, pin, store_id, active)
      VALUES (${s.name}, ${s.role}, ${s.pin}, ${store.id}, true)
      RETURNING id, name, pin
    `;
    staffUsers.push(u);
    console.log(`✅ สร้าง staff: ${u.name} (PIN: ${s.pin})`);
  }

  // ── 5. Products (15 รายการ) ─────────────────────────────────────────────
  const productDefs = [
    { id: "PRD-001", name: "น้ำมันพืช",     category: "เครื่องปรุง", zone: "A", unit: "ขวด",    minStock: 5  },
    { id: "PRD-002", name: "ซีอิ๊วขาว",    category: "เครื่องปรุง", zone: "A", unit: "ขวด",    minStock: 5  },
    { id: "PRD-003", name: "น้ำปลา",        category: "เครื่องปรุง", zone: "A", unit: "ขวด",    minStock: 3  },
    { id: "PRD-004", name: "ข้าวสาร",       category: "วัตถุดิบหลัก", zone: "B", unit: "กระสอบ", minStock: 2  },
    { id: "PRD-005", name: "เนื้อหมูสับ",   category: "โปรตีน",     zone: "C", unit: "กิโล",   minStock: 3  },
    { id: "PRD-006", name: "เนื้อไก่",      category: "โปรตีน",     zone: "C", unit: "กิโล",   minStock: 3  },
    { id: "PRD-007", name: "ผักบุ้ง",       category: "ผัก",        zone: "D", unit: "กิโล",   minStock: 2  },
    { id: "PRD-008", name: "กะเพรา",        category: "ผัก",        zone: "D", unit: "กำ",     minStock: 10 },
    { id: "PRD-009", name: "หอมใหญ่",       category: "เครื่องเทศ", zone: "A", unit: "กิโล",   minStock: 2  },
    { id: "PRD-010", name: "กระเทียม",      category: "เครื่องเทศ", zone: "A", unit: "กิโล",   minStock: 2  },
    { id: "PRD-011", name: "พริกแดง",       category: "เครื่องเทศ", zone: "A", unit: "กิโล",   minStock: 1  },
    { id: "PRD-012", name: "ไข่ไก่",        category: "โปรตีน",     zone: "C", unit: "ฟอง",    minStock: 20 },
    { id: "PRD-013", name: "แก๊ส LPG",      category: "สาธารณูปโภค", zone: "E", unit: "ถัง",    minStock: 1  },
    { id: "PRD-014", name: "กล่องข้าว",     category: "บรรจุภัณฑ์", zone: "B", unit: "ใบ",     minStock: 100 },
    { id: "PRD-015", name: "ถุงพลาสติก",   category: "บรรจุภัณฑ์", zone: "B", unit: "ใบ",     minStock: 200 },
  ];

  // ── 6. Insert Products ก่อน (stock=0 จะ update หลัง movements) ───────────
  for (const p of productDefs) {
    await sql`
      INSERT INTO products (id, name, category, zone, stock, min_stock, unit, store_id)
      VALUES (${p.id}, ${p.name}, ${p.category}, ${p.zone}, 0, ${p.minStock}, ${p.unit}, ${store.id})
    `;
  }
  console.log(`✅ สร้าง products จำนวน ${productDefs.length} รายการ (stock=0 ก่อน)`);

  // คำนวณ stock จาก movements
  const stockMap = {};
  for (const p of productDefs) stockMap[p.id] = 0;

  // ── 7. สร้าง Movements (30 วันย้อนหลัง) ─────────────────────────────────
  console.log("\n📦 กำลังสร้าง movements...");

  const movements = [];
  const pins = staffUsers.map((u) => u.pin);

  // patterns ตามประเภทสินค้า
  const restockSchedule = {
    // เติมทุก 7-10 วัน
    "PRD-001": { inQty: [5, 10],  outQtyPerDay: [1, 2],  inFreqDays: 8  },
    "PRD-002": { inQty: [5, 8],   outQtyPerDay: [0, 1],  inFreqDays: 10 },
    "PRD-003": { inQty: [4, 6],   outQtyPerDay: [0, 1],  inFreqDays: 12 },
    "PRD-004": { inQty: [3, 5],   outQtyPerDay: [0, 1],  inFreqDays: 14 },
    // เติมและใช้ทุกวัน (สินค้าสด)
    "PRD-005": { inQty: [3, 6],   outQtyPerDay: [2, 5],  inFreqDays: 2  },
    "PRD-006": { inQty: [3, 6],   outQtyPerDay: [2, 5],  inFreqDays: 2  },
    "PRD-007": { inQty: [2, 4],   outQtyPerDay: [1, 3],  inFreqDays: 2  },
    "PRD-008": { inQty: [5, 10],  outQtyPerDay: [3, 8],  inFreqDays: 3  },
    "PRD-009": { inQty: [2, 4],   outQtyPerDay: [0, 1],  inFreqDays: 7  },
    "PRD-010": { inQty: [2, 4],   outQtyPerDay: [0, 1],  inFreqDays: 7  },
    "PRD-011": { inQty: [1, 3],   outQtyPerDay: [0, 1],  inFreqDays: 10 },
    "PRD-012": { inQty: [20, 30], outQtyPerDay: [3, 8],  inFreqDays: 4  },
    "PRD-013": { inQty: [2, 3],   outQtyPerDay: [0, 0],  inFreqDays: 15 },
    "PRD-014": { inQty: [100, 200], outQtyPerDay: [10, 25], inFreqDays: 7 },
    "PRD-015": { inQty: [200, 300], outQtyPerDay: [20, 40], inFreqDays: 7 },
  };

  const inNotes  = ["เติมสต็อกของ", "รับของจากซัพพลายเออร์", "สั่งของเพิ่ม", "ของมาถึง"];
  const outNotes = ["เบิกไปใช้ครัว", "ใช้วันนี้", "เตรียมเมนูเช้า", "เบิกสำหรับออเดอร์"];

  for (const [productId, pattern] of Object.entries(restockSchedule)) {
    for (let day = 30; day >= 1; day--) {
      // MOVE_IN ตาม frequency
      if (day % pattern.inFreqDays === 0 || day === 30) {
        const qty = rand(pattern.inQty[0], pattern.inQty[1]);
        movements.push({
          productId,
          pin: pick(pins),
          type: "MOVE_IN",
          qty,
          note: pick(inNotes),
          createdAt: daysAgo(day, 7, 10),
        });
        stockMap[productId] += qty;
      }

      // MOVE_OUT ทุกวัน (ยกเว้น outQtyPerDay = [0,0])
      if (pattern.outQtyPerDay[1] > 0) {
        const qty = rand(pattern.outQtyPerDay[0], pattern.outQtyPerDay[1]);
        if (qty > 0 && stockMap[productId] >= qty) {
          movements.push({
            productId,
            pin: pick(pins),
            type: "MOVE_OUT",
            qty,
            note: pick(outNotes),
            createdAt: daysAgo(day, 11, 20),
          });
          stockMap[productId] -= qty;
        }
      }
    }
  }

  // shuffle เพื่อให้ไม่เรียงตาม product
  movements.sort((a, b) => a.createdAt - b.createdAt);

  // insert movements
  for (const m of movements) {
    await sql`
      INSERT INTO movements (product_id, employee_pin, type, qty, note, store_id, created_at)
      VALUES (${m.productId}, ${m.pin}, ${m.type}, ${m.qty}, ${m.note}, ${store.id}, ${m.createdAt})
    `;
  }
  console.log(`✅ สร้าง movements จำนวน ${movements.length} รายการ`);

  // ── อัปเดต stock ให้ตรงกับผลของ movements ────────────────────────────────
  for (const p of productDefs) {
    const finalStock = Math.max(stockMap[p.id], 0);
    await sql`UPDATE products SET stock = ${finalStock} WHERE id = ${p.id}`;
  }
  console.log(`✅ อัปเดต stock ทุก product ให้สอดคล้องกับ movements`);

  // ── 8. Cash Withdrawals (18 รายการ) ────────────────────────────────────
  const cashEntries = [
    { amount: 1500,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 30 },
    { amount: 800,   reason: "ค่าขนส่งสินค้า",           day: 28 },
    { amount: 2200,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 26 },
    { amount: 350,   reason: "ค่าใช้จ่ายเบ็ดเตล็ด",     day: 25 },
    { amount: 1800,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 23 },
    { amount: 500,   reason: "ค่าขนส่งสินค้า",           day: 21 },
    { amount: 2500,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 19 },
    { amount: 400,   reason: "ค่าใช้จ่ายเบ็ดเตล็ด",     day: 18 },
    { amount: 1200,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 16 },
    { amount: 700,   reason: "ค่าขนส่งสินค้า",           day: 14 },
    { amount: 2800,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 12 },
    { amount: 300,   reason: "ค่าใช้จ่ายเบ็ดเตล็ด",     day: 11 },
    { amount: 1600,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 9  },
    { amount: 600,   reason: "ค่าขนส่งสินค้า",           day: 7  },
    { amount: 1900,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 5  },
    { amount: 450,   reason: "ค่าใช้จ่ายเบ็ดเตล็ด",     day: 4  },
    { amount: 2100,  reason: "ซื้อวัตถุดิบตลาดเช้า",    day: 2  },
    { amount: 550,   reason: "ค่าขนส่งสินค้า",           day: 1  },
  ];

  for (const c of cashEntries) {
    const pin = pick(pins);
    await sql`
      INSERT INTO cash_withdrawals (store_id, amount, reason, employee_pin, created_at)
      VALUES (${store.id}, ${c.amount}, ${c.reason}, ${pin}, ${daysAgo(c.day, 7, 12)})
    `;
  }
  console.log(`✅ สร้าง cash_withdrawals จำนวน ${cashEntries.length} รายการ`);

  // ── สรุป ─────────────────────────────────────────────────────────────────
  const totalCash = cashEntries.reduce((s, c) => s + c.amount, 0);
  console.log(`
╔══════════════════════════════════════════════════╗
║         🎉 Seed เสร็จสมบูรณ์!                  ║
╠══════════════════════════════════════════════════╣
║  ร้าน       : ครัวคุณแม่                        ║
║  Admin      : kruamae@diam.demo / demo1234      ║
║  Staff PINs : 1111 / 2222 / 3333               ║
║  Products   : ${String(productDefs.length).padEnd(3)} รายการ                     ║
║  Movements  : ${String(movements.length).padEnd(3)} รายการ (30 วันย้อนหลัง)   ║
║  Cash Out   : ${String(cashEntries.length).padEnd(3)} รายการ / รวม ${totalCash.toLocaleString()} บาท        ║
╚══════════════════════════════════════════════════╝
`);

  await sql.end();
}

seed().catch((err) => {
  console.error("❌ Seed ล้มเหลว:", err.message);
  process.exit(1);
});
