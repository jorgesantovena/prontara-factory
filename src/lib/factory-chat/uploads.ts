/**
 * Adjuntos del chat de Factory.
 *
 * Acepta archivos de tipos reconocibles por texto (md/txt/csv/json/html/pdf/docx),
 * los guarda en `data/factory/chat/uploads/<id>.<ext>` y extrae el texto plano
 * en el momento de subida. Ese texto es lo que se envía como contexto al LLM
 * — no el binario. Así evitamos inflar el prompt con contenido inútil y
 * controlamos el tamaño por caracteres extraídos.
 *
 * Límite de tamaño por archivo: 10 MB. Límite de texto extraído por archivo:
 * 200 000 caracteres (se trunca con aviso).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_EXTRACTED_CHARS = 200_000;

export type UploadMeta = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  extension: string;
  extractedChars: number;
  truncated: boolean;
  /**
   * Si es una imagen que el chat puede enviar al modelo como content block
   * image. Los formatos que acepta Anthropic son png, jpeg, gif, webp.
   */
  isImage: boolean;
  /** media_type tal y como lo esperará la API de Anthropic (image/png etc.). */
  imageMediaType?: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
};

const IMAGE_EXTENSIONS: Record<string, "image/png" | "image/jpeg" | "image/gif" | "image/webp"> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function detectImageMediaType(ext: string, mime: string): UploadMeta["imageMediaType"] | null {
  const fromExt = IMAGE_EXTENSIONS[ext.toLowerCase()];
  if (fromExt) return fromExt;
  const lowerMime = String(mime || "").toLowerCase();
  if (lowerMime === "image/png") return "image/png";
  if (lowerMime === "image/jpeg" || lowerMime === "image/jpg") return "image/jpeg";
  if (lowerMime === "image/gif") return "image/gif";
  if (lowerMime === "image/webp") return "image/webp";
  return null;
}

export function getUploadBinaryPath(id: string, extension: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const ext = String(extension || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ext) return null;
  const filePath = path.join(getUploadsDir(), id + "." + ext);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

function getUploadsDir(): string {
  const dir = path.join(process.cwd(), "data", "factory", "chat", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function generateId(): string {
  return "u-" + crypto.randomBytes(12).toString("hex");
}

function cleanFileName(name: string): string {
  return String(name || "adjunto")
    .replace(/[^\w.\- ]/g, "")
    .slice(0, 120);
}

function extensionOf(name: string): string {
  const ext = path.extname(name).toLowerCase().replace(".", "");
  return ext || "bin";
}

// ---------------------------------------------------------------------
// Magic bytes — validación de tipo real del archivo (SEC-3).
//
// Antes de aceptar el upload comprobamos que los primeros bytes
// corresponden al formato que declara la extensión. Esto frena el
// truco clásico de subir un .jpg que en realidad es un binario
// ejecutable (PE/ELF/Mach-O) o un script disfrazado.
// ---------------------------------------------------------------------

type DetectedFormat =
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "pdf"
  | "zip" // docx/xlsx/pptx también
  | "executable" // PE / ELF / Mach-O / Java class
  | "text"
  | "unknown";

function detectFormatByMagic(buffer: Buffer): DetectedFormat {
  if (buffer.length < 4) return "unknown";

  const b = buffer;

  // Imágenes
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "png";
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return "gif";
  }
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "webp";
  }

  // PDF
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return "pdf";
  }

  // Zip-based: docx, xlsx, pptx, jar, apk, plain zip → "PK\x03\x04"
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    return "zip";
  }

  // Ejecutables (rechazar siempre)
  if (b[0] === 0x4d && b[1] === 0x5a) return "executable"; // PE (Windows .exe/.dll)
  if (b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46)
    return "executable"; // ELF (Linux)
  if (b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe)
    return "executable"; // Java class / Mach-O fat
  if (
    (b[0] === 0xfe && b[1] === 0xed && b[2] === 0xfa && b[3] === 0xce) ||
    (b[0] === 0xfe && b[1] === 0xed && b[2] === 0xfa && b[3] === 0xcf) ||
    (b[0] === 0xce && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe) ||
    (b[0] === 0xcf && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe)
  ) {
    return "executable"; // Mach-O
  }

  // Heurística: ¿parece texto razonable?
  // Si los primeros 512 bytes no contienen NUL ni mayoría de bytes >127,
  // lo asumimos texto. Esto cubre md/txt/csv/json/xml/html/yml/log/...
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  let nuls = 0;
  let highBytes = 0;
  for (const byte of sample) {
    if (byte === 0) nuls += 1;
    else if (byte > 127) highBytes += 1;
  }
  // Tolerancia: NULs son red flag binario; high bytes pueden ser UTF-8 válido
  if (nuls === 0 && highBytes < sample.length * 0.3) return "text";

  return "unknown";
}

const TEXT_EXTENSIONS = new Set([
  "md",
  "markdown",
  "txt",
  "csv",
  "tsv",
  "json",
  "log",
  "html",
  "htm",
  "xml",
  "yml",
  "yaml",
]);

/**
 * Comprueba que la extensión declarada coincide con los magic bytes
 * reales del fichero. Devuelve null si OK, o un string con el motivo
 * de rechazo si no coincide.
 */
function validateMagicBytes(extension: string, buffer: Buffer): string | null {
  const detected = detectFormatByMagic(buffer);
  const ext = extension.toLowerCase();

  // Ejecutables: rechazo absoluto, ignorando la extensión declarada.
  if (detected === "executable") {
    return "El archivo subido contiene un ejecutable binario (PE/ELF/Mach-O). Rechazado por seguridad.";
  }

  // Imágenes
  if (ext === "png") {
    return detected === "png" ? null : "Extensión .png pero el contenido no es PNG válido.";
  }
  if (ext === "jpg" || ext === "jpeg") {
    return detected === "jpeg" ? null : "Extensión .jpg/.jpeg pero el contenido no es JPEG válido.";
  }
  if (ext === "gif") {
    return detected === "gif" ? null : "Extensión .gif pero el contenido no es GIF válido.";
  }
  if (ext === "webp") {
    return detected === "webp" ? null : "Extensión .webp pero el contenido no es WebP válido.";
  }

  // PDF
  if (ext === "pdf") {
    return detected === "pdf" ? null : "Extensión .pdf pero el contenido no empieza por la firma PDF.";
  }

  // Office (docx/xlsx/pptx) → contenedor zip
  if (ext === "docx" || ext === "xlsx" || ext === "pptx") {
    return detected === "zip"
      ? null
      : "Extensión Office (." + ext + ") pero el contenido no es un contenedor zip válido.";
  }

  // Texto: aceptamos solo si la heurística lo identifica como texto.
  if (TEXT_EXTENSIONS.has(ext)) {
    return detected === "text"
      ? null
      : "Extensión ." + ext + " pero el contenido no parece texto plano (bytes binarios detectados).";
  }

  // Cualquier otra extensión NO está en la whitelist y se rechaza.
  return "Tipo de archivo no soportado: ." + ext;
}

export type SaveUploadInput = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

export type SaveUploadResult = {
  meta: UploadMeta;
  extractedText: string;
};

/**
 * Guarda el archivo y extrae texto plano según extensión. Si el formato
 * no es reconocible, deja el archivo pero extractedText queda vacío con
 * una nota indicando el motivo.
 */
export async function saveUpload(input: SaveUploadInput): Promise<SaveUploadResult> {
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      "Archivo demasiado grande. Máximo " + MAX_UPLOAD_BYTES / (1024 * 1024) + " MB.",
    );
  }

  const id = generateId();
  const cleanName = cleanFileName(input.originalName);
  const ext = extensionOf(cleanName);

  // Validación de magic bytes (SEC-3): el contenido debe coincidir con
  // la extensión. Bloquea ejecutables disfrazados de imagen y formatos
  // no soportados.
  const magicError = validateMagicBytes(ext, input.buffer);
  if (magicError) {
    throw new Error(magicError);
  }

  const filePath = path.join(getUploadsDir(), id + "." + ext);

  fs.writeFileSync(filePath, input.buffer);

  const imageMediaType = detectImageMediaType(ext, input.mimeType);
  const isImage = imageMediaType !== null;

  const extracted = isImage
    ? "[Imagen " + cleanName + " adjuntada. El modelo la recibe como bloque visual, no se extrae texto aquí.]"
    : await extractText(filePath, ext, input.buffer, input.mimeType);
  const truncated = extracted.length > MAX_EXTRACTED_CHARS;
  const finalText = truncated ? extracted.slice(0, MAX_EXTRACTED_CHARS) : extracted;

  const meta: UploadMeta = {
    id,
    originalName: cleanName,
    mimeType: input.mimeType || "application/octet-stream",
    size: input.buffer.byteLength,
    uploadedAt: new Date().toISOString(),
    extension: ext,
    extractedChars: finalText.length,
    truncated,
    isImage,
    imageMediaType: imageMediaType || undefined,
  };

  writeJsonAtomic(path.join(getUploadsDir(), id + ".meta.json"), meta);
  fs.writeFileSync(path.join(getUploadsDir(), id + ".txt"), finalText);

  return { meta, extractedText: finalText };
}

export function readUploadText(id: string): { meta: UploadMeta; text: string } | null {
  const metaPath = path.join(getUploadsDir(), id + ".meta.json");
  const textPath = path.join(getUploadsDir(), id + ".txt");
  if (!fs.existsSync(metaPath)) return null;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as UploadMeta;
    const text = fs.existsSync(textPath) ? fs.readFileSync(textPath, "utf8") : "";
    return { meta, text };
  } catch {
    return null;
  }
}

async function extractText(
  filePath: string,
  ext: string,
  buffer: Buffer,
  mime: string,
): Promise<string> {
  const normalized = ext.toLowerCase();

  if (
    normalized === "md" ||
    normalized === "markdown" ||
    normalized === "txt" ||
    normalized === "csv" ||
    normalized === "tsv" ||
    normalized === "json" ||
    normalized === "log" ||
    normalized === "html" ||
    normalized === "htm" ||
    normalized === "xml" ||
    normalized === "yml" ||
    normalized === "yaml" ||
    mime.startsWith("text/")
  ) {
    try {
      return buffer.toString("utf8");
    } catch {
      return "";
    }
  }

  if (normalized === "pdf") {
    return await extractPdf(filePath, buffer);
  }

  if (normalized === "docx") {
    return await extractDocx(filePath, buffer);
  }

  return (
    "[Archivo " +
    path.basename(filePath) +
    " (" +
    mime +
    ") guardado. No hay extractor de texto para este formato todavía — sube el contenido como .md, .txt, .pdf o .docx si necesitas que el asistente lo lea.]"
  );
}

async function extractPdf(_filePath: string, buffer: Buffer): Promise<string> {
  try {
    // pdf-parse está en las dependencias del repo. Importación dinámica
    // para aplazar la carga (es una lib pesada con diccionarios) y
    // evitar que el bundler de Next la incluya en el chunk inicial.
    // Tipamos manualmente porque los types declarados son inestables.
    const mod = (await import("pdf-parse")) as unknown as {
      default?: (b: Buffer) => Promise<{ text: string }>;
    };
    const fn = mod.default;
    if (!fn) return "[No se pudo cargar pdf-parse.]";
    const result = await fn(buffer);
    return String(result?.text || "").trim();
  } catch (err) {
    return "[Error extrayendo PDF: " + (err instanceof Error ? err.message : "desconocido") + "]";
  }
}

async function extractDocx(_filePath: string, buffer: Buffer): Promise<string> {
  try {
    // mammoth está en las dependencias del repo. Importación dinámica
    // por las mismas razones que pdf-parse arriba.
    const mod = (await import("mammoth")) as unknown as {
      extractRawText?: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const extractRawText = mod.extractRawText;
    if (!extractRawText) return "[No se pudo cargar mammoth.]";
    const result = await extractRawText({ buffer });
    return String(result?.value || "").trim();
  } catch (err) {
    return "[Error extrayendo DOCX: " + (err instanceof Error ? err.message : "desconocido") + "]";
  }
}
