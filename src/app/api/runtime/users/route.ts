import { NextRequest, NextResponse } from "next/server";
import {
  getSessionFromRequest,
  requestMatchesTenantSession,
} from "@/lib/saas/auth-session";
import {
  createTenantMemberAccount,
  listTenantAccounts,
  updateTenantAccountRole,
} from "@/lib/saas/account-store";
import type { TenantAccountRole } from "@/lib/saas/account-definition";
import { assertUserCreationAllowed } from "@/lib/saas/billing-limits";

function canManageUsers(role: string) {
  return role === "owner" || role === "admin";
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

    if (!requestMatchesTenantSession(request, session)) {
      return NextResponse.json(
        {
          ok: false,
          error: "La sesión no coincide con el tenant solicitado.",
        },
        { status: 403 }
      );
    }

    const accounts = listTenantAccounts(session.clientId).map((item) => ({
      id: item.id,
      email: item.email,
      fullName: item.fullName,
      role: item.role,
      status: item.status,
      mustChangePassword: item.mustChangePassword,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return NextResponse.json({
      ok: true,
      accounts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en users.",
      },
      { status: 500 }
    );
  }
}

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

    if (!canManageUsers(session.role)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No tienes permisos para gestionar usuarios.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const mode = String(body?.mode || "create").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const fullName = String(body?.fullName || "").trim();
    const role = String(body?.role || "").trim() as TenantAccountRole;

    if (mode === "create") {
      assertUserCreationAllowed(request);

      if (!email || !fullName || !role) {
        return NextResponse.json(
          {
            ok: false,
            error: "Faltan datos obligatorios del usuario.",
          },
          { status: 400 }
        );
      }

      const created = createTenantMemberAccount({
        tenantId: session.tenantId,
        clientId: session.clientId,
        slug: session.slug,
        email,
        fullName,
        role,
      });

      return NextResponse.json({
        ok: true,
        account: {
          id: created.id,
          email: created.email,
          fullName: created.fullName,
          role: created.role,
          status: created.status,
          temporaryPassword: created.temporaryPassword,
          mustChangePassword: created.mustChangePassword,
        },
      });
    }

    if (mode === "role") {
      const accountId = String(body?.accountId || "").trim();
      if (!accountId || !role) {
        return NextResponse.json(
          {
            ok: false,
            error: "Faltan accountId o role.",
          },
          { status: 400 }
        );
      }

      const updated = updateTenantAccountRole({
        clientId: session.clientId,
        accountId,
        role,
      });

      return NextResponse.json({
        ok: true,
        account: {
          id: updated.id,
          email: updated.email,
          fullName: updated.fullName,
          role: updated.role,
          status: updated.status,
          mustChangePassword: updated.mustChangePassword,
        },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Modo no soportado.",
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno creando o editando usuario.",
      },
      { status: 500 }
    );
  }
}