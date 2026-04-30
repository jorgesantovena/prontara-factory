import { NextRequest, NextResponse } from "next/server";
import {
  applyEvolutionActionFromRequest,
  rollbackEvolutionEntryFromRequest,
} from "@/lib/saas/evolution-engine";
import type { EvolutionActionType } from "@/lib/saas/evolution-definition";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = String(body?.mode || "apply").trim();
    const createdBy = String(body?.createdBy || "owner").trim();

    if (mode === "rollback") {
      const entryId = String(body?.entryId || "").trim();

      if (!entryId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Falta entryId para rollback.",
          },
          { status: 400 }
        );
      }

      const result = rollbackEvolutionEntryFromRequest({
        request,
        entryId,
        createdBy,
      });

      return NextResponse.json({
        ok: true,
        result,
      });
    }

    const actionType = String(body?.actionType || "").trim() as EvolutionActionType;
    const payload = body?.payload || {};

    if (!actionType) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta actionType.",
        },
        { status: 400 }
      );
    }

    const result = applyEvolutionActionFromRequest({
      request,
      actionType,
      payload,
      createdBy,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/runtime/evolution-apply",
      },
      { status: 500 }
    );
  }
}