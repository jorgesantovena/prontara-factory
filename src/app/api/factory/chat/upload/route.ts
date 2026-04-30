import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import { saveUpload } from "@/lib/factory-chat/uploads";

/**
 * POST /api/factory/chat/upload
 * Acepta un archivo multipart (campo "file") y lo guarda en disco con
 * el texto extraído. Devuelve el meta para que la UI lo adjunte al
 * próximo mensaje del usuario.
 */
export async function POST(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Falta el campo 'file' en la petición." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { meta, extractedText } = await saveUpload({
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    return NextResponse.json({
      ok: true,
      meta,
      preview: extractedText.slice(0, 400),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error subiendo archivo." },
      { status: 500 },
    );
  }
}
