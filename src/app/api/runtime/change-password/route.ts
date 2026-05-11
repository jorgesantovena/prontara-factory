import { NextRequest, NextResponse } from "next/server";
import {
  getSessionFromRequest,
  requestMatchesTenantSession,
  attachSessionCookie,
} from "@/lib/saas/auth-session";
import {
  setTenantAccountPasswordAsync,
  getTenantAccountByIdAsync,
} from "@/lib/persistence/account-store-async";

export async function POST(request: NextRequest) {
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

    if (!requestMatchesTenantSession(request, session)) {
      return NextResponse.json(
        {
          ok: false,
          error: "La sesión no coincide con el tenant solicitado.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const newPassword = String(body?.newPassword || "").trim();

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error: "La nueva contraseña debe tener al menos 8 caracteres.",
        },
        { status: 400 }
      );
    }

    const updated = await setTenantAccountPasswordAsync({
      clientId: session.clientId,
      accountId: session.accountId,
      nextPassword: newPassword,
      clearTemporaryPassword: true,
    });

    const response = NextResponse.json({
      ok: true,
      account: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        mustChangePassword: updated.mustChangePassword,
      },
    });

    attachSessionCookie(response, {
      accountId: updated.id,
      tenantId: updated.tenantId,
      clientId: updated.clientId,
      slug: updated.slug,
      // H13-C/D: preservar businessType del session previo para que el
      // middleware siga sabiendo a qué vertical pertenece tras refresh.
      businessType: session.businessType,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      mustChangePassword: updated.mustChangePassword,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error cambiando contraseña.",
      },
      { status: 500 }
    );
  }
}

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

    const account = await getTenantAccountByIdAsync({
      clientId: session.clientId,
      accountId: session.accountId,
    });

    return NextResponse.json({
      ok: true,
      mustChangePassword: Boolean(account?.mustChangePassword),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno.",
      },
      { status: 500 }
    );
  }
}