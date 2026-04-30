import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getFactoryDashboardSnapshot } from "@/lib/factory/factory-dashboard";

function writeDebugLog(payload: unknown) {
  try {
    const logPath = path.join(process.cwd(), "..", "prontara-dashboard-error.txt");
    const stamp = new Date().toISOString();
    const body =
      typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    fs.appendFileSync(logPath, "[" + stamp + "]\n" + body + "\n\n", "utf8");
  } catch {
    // ignore disk errors
  }
}

export async function GET() {
  try {
    const snapshot = getFactoryDashboardSnapshot();

    return NextResponse.json({
      ok: true,
      snapshot,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error interno en /api/factory/dashboard";
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("[/api/factory/dashboard] ERROR:", message);
    if (stack) console.error("[/api/factory/dashboard] STACK:", stack);
    writeDebugLog({ message, stack });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        stack,
      },
      { status: 500 }
    );
  }
}
