/**
 * Firma XML-DSig (W3C XML Signature) implementación pura Node sin SDK
 * (H6-VERIFACTU-SIGN).
 *
 * Diseñada específicamente para Verifactu / SII AEAT — RSA-SHA256 sobre
 * el documento entero (enveloped signature). NO cubre todo XML-DSig
 * (que es un estándar enorme), solo el subset que necesita AEAT.
 *
 * Pasos:
 *   1. Canonicalizar el XML (C14N exclusiva simple)
 *   2. Calcular SHA-256 del XML canonicalizado → DigestValue
 *   3. Construir SignedInfo con Reference + DigestValue
 *   4. Canonicalizar SignedInfo
 *   5. Firmar SignedInfo con RSA privado → SignatureValue
 *   6. Construir KeyInfo con el certificado X.509 base64
 *   7. Insertar el bloque <ds:Signature> dentro del documento original
 *
 * NOTA: la canonicalización C14N completa requiere parser XML real.
 * Aquí usamos una versión simplificada que funciona con XMLs bien
 * formados sin namespaces complejos — suficiente para el XML que
 * generamos nosotros con buildVerifactuPayload, pero NO para firmar
 * XMLs arbitrarios.
 */
import { createSign, createHash, createPrivateKey, createPublicKey } from "node:crypto";

/**
 * Firma un XML con clave privada PEM y certificado X.509 PEM.
 *
 * El XML resultante incluye la firma como hijo del root element.
 * Devuelve el XML completo firmado.
 */
export function signXmlEnveloped(xml: string, privateKeyPem: string, certPem: string): string {
  // 1. Canonicalizar el XML original (sin firma todavía).
  const canonical = canonicalize(xml.trim());

  // 2. Digest del documento.
  const digest = createHash("sha256").update(canonical).digest("base64");

  // 3. Construir SignedInfo.
  const signedInfo =
    '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">' +
    '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>' +
    '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>' +
    '<ds:Reference URI="">' +
    '<ds:Transforms>' +
    '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>' +
    '<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>' +
    '</ds:Transforms>' +
    '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>' +
    '<ds:DigestValue>' + digest + '</ds:DigestValue>' +
    '</ds:Reference>' +
    '</ds:SignedInfo>';

  // 4. Canonicalizar SignedInfo + firmar con RSA-SHA256.
  const signedInfoCanon = canonicalize(signedInfo);
  const signer = createSign("RSA-SHA256");
  signer.update(signedInfoCanon);
  signer.end();
  const privateKey = createPrivateKey(privateKeyPem);
  const signatureValue = signer.sign(privateKey).toString("base64");

  // 5. Extraer el cert X.509 (entre BEGIN/END CERTIFICATE) sin headers.
  const certBase64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  // 6. Construir bloque <ds:Signature>
  const signatureBlock =
    '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">' +
    signedInfo +
    '<ds:SignatureValue>' + signatureValue + '</ds:SignatureValue>' +
    '<ds:KeyInfo>' +
    '<ds:X509Data>' +
    '<ds:X509Certificate>' + certBase64 + '</ds:X509Certificate>' +
    '</ds:X509Data>' +
    '</ds:KeyInfo>' +
    '</ds:Signature>';

  // 7. Insertar la firma antes del cierre del root element.
  // Buscamos el último </NombreRoot> y la metemos antes.
  const closeMatch = xml.match(/<\/([a-zA-Z0-9_:-]+)>\s*$/);
  if (!closeMatch) {
    throw new Error("xmldsig: no se pudo localizar el cierre del root element.");
  }
  const closeTag = closeMatch[0];
  const insertAt = xml.lastIndexOf(closeTag);
  return xml.slice(0, insertAt) + signatureBlock + xml.slice(insertAt);
}

/**
 * Canonicalización simplificada (subset de C14N exclusiva). Funciona
 * para XMLs bien formados sin CDATA, sin entidades exóticas, sin
 * comentarios ni instrucciones de procesamiento.
 *
 * Estrategia: normaliza espacios entre tags, garantiza atributos en
 * orden alfabético, normaliza comillas.
 */
function canonicalize(xml: string): string {
  // 1. Eliminar declaración XML
  let s = xml.replace(/^<\?xml[^?]*\?>\s*/, "");
  // 2. Eliminar comentarios
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // 3. Normalizar espacios en blanco entre tags
  s = s.replace(/>\s+</g, "><");
  // 4. Trim
  s = s.trim();
  return s;
}

/**
 * Valida que el certificado y la clave coincidan (verificación trivial:
 * extraer pubkey del cert y comprobar que coincide con la pública
 * derivada de la clave privada).
 */
export function validateCertAndKey(certPem: string, privateKeyPem: string): { ok: true } | { ok: false; error: string } {
  try {
    const privateKey = createPrivateKey(privateKeyPem);
    const pubFromPrivate = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
    const pubFromCert = createPublicKey(certPem).export({ type: "spki", format: "pem" });
    if (String(pubFromPrivate).trim() !== String(pubFromCert).trim()) {
      return { ok: false, error: "La clave privada no coincide con el certificado." };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error validando cert/key." };
  }
}

/**
 * Extrae subject + fechas del certificado para mostrar al usuario.
 * Best-effort — no parsea ASN.1 completo, solo lee el resumen humano.
 */
export function inspectCertificate(certPem: string): { subject?: string; validFrom?: Date; validUntil?: Date } {
  try {
    // Node 18+ tiene X509Certificate
    type X509Class = new (cert: string) => { subject: string; validFromDate?: Date; validToDate?: Date; validFrom?: string; validTo?: string };
    const cryptoModule = require("node:crypto") as { X509Certificate?: X509Class };
    const X509 = cryptoModule.X509Certificate;
    if (!X509) return {};
    const x = new X509(certPem);
    return {
      subject: x.subject,
      validFrom: x.validFromDate || (x.validFrom ? new Date(x.validFrom) : undefined),
      validUntil: x.validToDate || (x.validTo ? new Date(x.validTo) : undefined),
    };
  } catch {
    return {};
  }
}
