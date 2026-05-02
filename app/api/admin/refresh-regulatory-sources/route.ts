import { NextResponse } from "next/server";
import { refreshRegulatorySources } from "@/lib/regulatory/refresh";
import { seedComplianceRules } from "@/lib/regulatory/rules";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const expected = process.env.ADMIN_REFRESH_SECRET;

  if (!expected) {
    return NextResponse.json({ error: "ADMIN_REFRESH_SECRET is not configured." }, { status: 500 });
  }

  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await refreshRegulatorySources();
  await seedComplianceRules();

  return NextResponse.json({
    ok: true,
    refreshed_at: new Date().toISOString(),
    results
  });
}
