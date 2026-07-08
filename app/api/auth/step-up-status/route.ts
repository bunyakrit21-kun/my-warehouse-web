import { NextResponse } from "next/server";
import { getUser, hasValidStepUp } from "@/lib/auth";

// Lets the accounting page know on mount whether it should show the password
// re-entry gate (spec-07 section 6.1) or the user already verified within the
// last 15 minutes.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const verified = await hasValidStepUp(user.id);
  return NextResponse.json({ verified });
}
