import { NextResponse } from "next/server";
import { runAlertMonitoringForAllBusinesses } from "@/lib/alerts/monitoring";

export async function POST() {
  await runAlertMonitoringForAllBusinesses();
  return NextResponse.json({ success: true });
}
