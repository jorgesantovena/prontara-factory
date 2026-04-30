import fs from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import { readUploadText, getUploadBinaryPath } from "@/lib/factory-chat/uploads";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/factory/chat/uploads/[id]/binary
 * Sirve el binario original del upload. Solo admins/owners. Útil para
 * mostrar thumbnails de imágenes en la UI del chat.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const upload = readUploadText(id);
  if (!upload) {
    return NextResponse.json(
      { ok: false, error: "Upload no encontrado." },
      { status: 404 },
    );
  }

  const filePath = getUploadBinaryPath(upload.meta.id, upload.meta.extension);
  if (!filePath) {
    return NextResponse.json(
      { ok: false, error: "Binario no disponible." },
      { status: 404 },
    );
  }

  try {
    const buffer = fs.readFileSync(filePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": upload.meta.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error leyendo binario.",
      },
      { status: 500 },
    );
  }
}
