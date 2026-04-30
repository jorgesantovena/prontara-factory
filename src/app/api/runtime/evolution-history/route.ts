import { NextRequest, NextResponse } from "next/server";
import {
  createEvolutionSnapshotFromRequest,
  getEvolutionHistoryFromRequest,
} from "@/lib/saas/evolution-engine";

export async function GET(request: NextRequest) {
  try {
    const history = getEvolutionHistoryFromRequest(request);

    if (!history) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo resolver el historial de evolucion del tenant solicitado.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      history,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en evolution-history.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = createEvolutionSnapshotFromRequest(request, body || {});

    if (!entry) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo crear el snapshot de evolucion para el tenant solicitado.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      entry,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno creando snapshot de evolucion.",
      },
      { status: 500 }
    );
  }
}