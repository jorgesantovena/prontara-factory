import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/saas/auth-session";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    return NextResponse.json({
      ok: true,
      authenticated: Boolean(session),
      session,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Session read failed",
      },
      { status: 500 }
    );
  }
}