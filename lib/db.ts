import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const sql = postgres(connectionString, {
  ssl: "require",
  max: 1,            // serverless: 1 connection per function instance
  idle_timeout: 20,  // คืน connection ภายใน 20s ถ้าไม่ใช้
  connect_timeout: 10,
  prepare: false,    // pgbouncer transaction mode ไม่รองรับ prepared statements
});

export default sql;