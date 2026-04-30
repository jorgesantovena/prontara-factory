import { NextRequest, NextResponse } from "next/server";
import { rollbackEvolutionFromRequest } from "@/lib/saas/evolution-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = rollbackEvolutionFromRequest(request, body || {});

    if (!entry) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo ejecutar el rollback del tenant solicitado.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      rollbackEntry: entry,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en evolution-rollback.",
      },
      { status: 500 }
    );
  }
}