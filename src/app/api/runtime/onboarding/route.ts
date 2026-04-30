import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/saas/auth-session";
import { getOnboardingState, saveOnboardingUiState } from "@/lib/saas/onboarding-store";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "No hay sesión activa.",
        },
        { status: 401 }
      );
    }

    const state = getOnboardingState(session.clientId, session.accountId);

    return NextResponse.json({
      ok: true,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en onboarding.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "No hay sesión activa.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const state = saveOnboardingUiState({
      clientId: session.clientId,
      accountId: session.accountId,
      dismissed: Boolean(body?.dismissed),
      manualDoneMap: body?.manualDoneMap || {},
    });

    return NextResponse.json({
      ok: true,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error actualizando onboarding.",
      },
      { status: 500 }
    );
  }
}