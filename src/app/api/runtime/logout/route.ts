import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/saas/auth-session";

export async function POST(_request: NextRequest) {
  try {
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en logout.",
      },
      { status: 500 }
    );
  }
}