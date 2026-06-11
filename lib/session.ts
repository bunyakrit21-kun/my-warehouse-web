import { SignJWT, jwtVerify } from "jose";

const secretString = process.env.SESSION_SECRET;
if (!secretString) {
  throw new Error("Missing SESSION_SECRET");
}
const secret = new TextEncoder().encode(secretString);

export const sessionCookie = {
  name: "diam_session",
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // ✅ แก้ตรงนี้
    sameSite: "lax" as const,                      // ✅ แนะนำ
    path: "/",
    maxAge: 60 * 60 * 2,                           // 2 ชั่วโมง (ให้ตรงกับ token)
  },
};

export async function createSessionToken(payload: { email: string; name: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload;
}