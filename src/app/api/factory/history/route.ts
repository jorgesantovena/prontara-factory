import { NextResponse } from "next/server";
import { readFactoryDiskHistory } from "@/lib/factory/factory-disk-history";
import { runFactoryHardening } from "@/lib/factory/factory-hardening";

export async function GET() {
  try {
    const history = readFactoryDiskHistory();
    const hardening = runFactoryHardening();

    return NextResponse.json({
      ok: true,
      history,
      hardening,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/history",
      },
      { status: 500 }
    );
  }
}