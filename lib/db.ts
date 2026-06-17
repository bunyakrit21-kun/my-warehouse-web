// lib/db.ts
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("❌ กรุณาตั้งค่า DATABASE_URL ในไฟล์ .env.local ก่อนทำงาน");
}

// สร้าง Instance สำหรับติดต่อฐานข้อมูล (Singleton Pattern ป้องกัน Connection เต็ม)
const sql = postgres(connectionString, {
  ssl: "require", // บังคับเข้ารหัสข้อมูลเพื่อความปลอดภัยของระบบคลังร้าน DiaM
});

export default sql;