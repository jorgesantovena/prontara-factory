/**
 * PUT a S3 con firma AWS Signature v4 manual, sin SDK (H4-BACKUP).
 *
 * Compatible con S3 nativo y con cualquier servicio S3-compatible
 * (Cloudflare R2, MinIO, Wasabi, Backblaze B2 con API S3, etc).
 *
 * Activación opcional vía env vars:
 *   S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT (opcional)
 *
 * Si alguna falta, `s3PutObject` retorna { ok: false, reason: "not_configured" }.
 */
import { createHash, createHmac } from "node:crypto";

export type S3Config = {
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  /** Para servicios S3-compatible. Si vacío, usa AWS estándar. */
  endpoint?: string;
};

export function getS3ConfigFromEnv(): S3Config | null {
  const bucket = String(process.env.S3_BUCKET || "").trim();
  const region = String(process.env.S3_REGION || "").trim();
  const accessKey = String(process.env.S3_ACCESS_KEY || "").trim();
  const secretKey = String(process.env.S3_SECRET_KEY || "").trim();
  const endpoint = String(process.env.S3_ENDPOINT || "").trim() || undefined;
  if (!bucket || !region || !accessKey || !secretKey) return null;
  return { bucket, region, accessKey, secretKey, endpoint };
}

export type S3PutResult =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: "not_configured" | "request_failed"; error?: string };

export async function s3PutObject(
  key: string,
  body: string | Buffer,
  contentType: string = "application/octet-stream",
): Promise<S3PutResult> {
  const cfg = getS3ConfigFromEnv();
  if (!cfg) return { ok: false, reason: "not_configured" };

  const host = cfg.endpoint
    ? new URL(cfg.endpoint).host
    : cfg.bucket + ".s3." + cfg.region + ".amazonaws.com";
  const protocol = "https";
  const path = "/" + (cfg.endpoint ? cfg.bucket + "/" : "") + encodeURIComponent(key).replace(/%2F/g, "/");
  const url = protocol + "://" + host + path;

  const bodyBuf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  const payloadHash = createHash("sha256").update(bodyBuf).digest("hex");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    "host": host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  // Canonical request
  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => k + ":" + headers[k] + "\n").join("");
  const signedHeaders = sortedHeaderKeys.join(";");
  const canonicalRequest = [
    "PUT",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // String to sign
  const credentialScope = dateStamp + "/" + cfg.region + "/s3/aws4_request";
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  // Signing key derivation
  const kDate = createHmac("sha256", "AWS4" + cfg.secretKey).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(cfg.region).digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorization =
    "AWS4-HMAC-SHA256 " +
    "Credential=" + cfg.accessKey + "/" + credentialScope + ", " +
    "SignedHeaders=" + signedHeaders + ", " +
    "Signature=" + signature;

  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: { ...headers, Authorization: authorization },
      body: bodyBuf as unknown as BodyInit,
    });
    if (!r.ok) {
      const errBody = await r.text();
      return { ok: false, reason: "request_failed", error: r.status + ": " + errBody.slice(0, 500) };
    }
    return { ok: true, url, key };
  } catch (err) {
    return {
      ok: false,
      reason: "request_failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
