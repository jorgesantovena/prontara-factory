/**
 * Cliente AEAT Verifactu (H14-C).
 *
 * Construye un SOAP envelope con el XML firmado en el body, lo POSTea al
 * endpoint AEAT (sandbox o producción según VERIFACTU_PROD) usando mTLS
 * con el certificado del tenant, y parsea la respuesta para extraer
 * estado + CSV/huella + posibles errores.
 *
 * Implementa la especificación pública de AEAT para el sistema VeriFactu
 * (RD 1007/2023 — sistemas de facturación verificables).
 *
 * Notas operativas:
 *   - El endpoint exige TLS con autenticación de cliente (mTLS). Usa
 *     `https.Agent` con cert+key del firmante. Sin mTLS, AEAT responde
 *     403 "client certificate required".
 *   - El SOAP envelope envuelve el XML firmado en namespace `sum:` (el
 *     que AEAT usa para "SuministroLR"). El XML firmado YA contiene su
 *     propia firma XML-DSig — NO se firma el envelope completo.
 *   - El timeout duro es 30s (AEAT puede tardar bajo carga).
 *   - Si la URL no se especifica vía env var, se usan las oficiales.
 */
import https from "node:https";

const AEAT_NS_SUMINISTRO = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd";
const DEFAULT_URL_TEST = "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP";
const DEFAULT_URL_PROD = "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP";

export type VerifactuSendInput = {
  /** XML ya firmado con XML-DSig enveloped. Se mete tal cual en el body SOAP. */
  signedXml: string;
  /** Cert PEM del firmante (mTLS). Mismo cert que firmó el XML. */
  certPem: string;
  /** Private key PEM del firmante. */
  keyPem: string;
  /** Passphrase de la key si está cifrada (opcional). */
  keyPassphrase?: string;
  /** Override del endpoint AEAT. Si vacío, usa los defaults. */
  endpointOverride?: string;
};

export type VerifactuSendResult = {
  ok: boolean;
  status: "sent" | "rejected" | "error";
  csvHuella: string | null;
  rawResponse: string;
  httpStatus: number;
  errorMsg: string | null;
  errorCode: string | null;
};

/**
 * Endpoint AEAT activo según VERIFACTU_PROD + posibles overrides.
 */
export function getAeatEndpoint(): string {
  const useProd = String(process.env.VERIFACTU_PROD || "").trim() === "true";
  if (useProd) {
    return String(process.env.VERIFACTU_AEAT_URL_PROD || "").trim() || DEFAULT_URL_PROD;
  }
  return String(process.env.VERIFACTU_AEAT_URL_TEST || "").trim() || DEFAULT_URL_TEST;
}

/**
 * Construye el SOAP envelope que envuelve el XML firmado.
 * AEAT espera el XML del registro de facturación dentro del Body.
 */
export function buildSoapEnvelope(signedXml: string): string {
  // Quita la declaración XML del signedXml si la tiene, porque el SOAP
  // envelope ya trae su propia declaración.
  const inner = signedXml.replace(/^\s*<\?xml[^?]*\?>\s*/i, "");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"`,
    `               xmlns:sum="${AEAT_NS_SUMINISTRO}">`,
    `  <soap:Body>`,
    `    ${inner}`,
    `  </soap:Body>`,
    `</soap:Envelope>`,
  ].join("\n");
}

/**
 * Parsea la respuesta SOAP de AEAT.
 *   - Si HTTP 200 + estado "Correcto": ok=true, csv extraído.
 *   - Si HTTP 200 + estado "Incorrecto"/"ParcialmenteCorrecto": ok=false con códigos.
 *   - Si HTTP 4xx/5xx: ok=false con httpStatus.
 *
 * AEAT responde con un XML como:
 *   <soap:Envelope><soap:Body>
 *     <sum:RespuestaRegFactuSistemaFacturacion>
 *       <sum:CSV>ABC123XYZ</sum:CSV>
 *       <sum:RespuestaLinea>
 *         <sum:EstadoRegistro>Correcto</sum:EstadoRegistro>
 *       </sum:RespuestaLinea>
 *     </sum:RespuestaRegFactuSistemaFacturacion>
 *   </soap:Body></soap:Envelope>
 *
 * Si hay un <soap:Fault> es un error técnico.
 */
export function parseAeatResponse(httpStatus: number, body: string): Omit<VerifactuSendResult, "rawResponse"> {
  const out = {
    ok: false,
    status: "error" as VerifactuSendResult["status"],
    csvHuella: null as string | null,
    httpStatus,
    errorMsg: null as string | null,
    errorCode: null as string | null,
  };

  if (httpStatus < 200 || httpStatus >= 300) {
    // Error HTTP. Intenta sacar mensaje del SOAP Fault si lo hay.
    const faultStr = body.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
    out.errorMsg = faultStr ? faultStr[1].trim() : ("HTTP " + httpStatus);
    return out;
  }

  // 200 OK — chequea SOAP Fault primero.
  if (/<soap:Fault\b/i.test(body) || /<env:Fault\b/i.test(body)) {
    const faultStr = body.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
    out.errorMsg = faultStr ? faultStr[1].trim() : "SOAP Fault sin detalle";
    return out;
  }

  // Estado de registro
  const estadoMatch = body.match(/<(?:sum:|tikC:|env:)?EstadoRegistro[^>]*>([^<]+)</i);
  const estado = estadoMatch ? estadoMatch[1].trim() : null;

  // CSV / huella
  const csvMatch = body.match(/<(?:sum:|tikC:|env:)?CSV[^>]*>([^<]+)</i);
  if (csvMatch) out.csvHuella = csvMatch[1].trim();

  // Códigos de error si los hay
  const errCodeMatch = body.match(/<(?:sum:|tikC:|env:)?CodigoErrorRegistro[^>]*>([^<]+)</i);
  const errDescMatch = body.match(/<(?:sum:|tikC:|env:)?DescripcionErrorRegistro[^>]*>([^<]+)</i);
  if (errCodeMatch) out.errorCode = errCodeMatch[1].trim();
  if (errDescMatch) out.errorMsg = errDescMatch[1].trim();

  if (estado === "Correcto" || estado === "AceptadoConErrores") {
    out.ok = true;
    out.status = "sent";
  } else if (estado === "Incorrecto" || estado === "Rechazado") {
    out.status = "rejected";
    out.ok = false;
  } else if (out.csvHuella) {
    // Si tenemos CSV pero no estado parseado, aceptamos optimistamente.
    out.ok = true;
    out.status = "sent";
  } else {
    out.errorMsg = out.errorMsg || "Respuesta AEAT sin estado reconocible.";
  }
  return out;
}

/**
 * Envía un XML firmado al endpoint AEAT con mTLS.
 *
 * Devuelve resultado parseado. NO lanza por errores HTTP — solo por
 * errores de red catastróficos (timeout, conexión rechazada).
 */
export async function sendToAeat(input: VerifactuSendInput): Promise<VerifactuSendResult> {
  const endpoint = input.endpointOverride || getAeatEndpoint();
  const envelope = buildSoapEnvelope(input.signedXml);
  const url = new URL(endpoint);

  // Configura agente HTTPS con mTLS: cert + key + passphrase del tenant.
  // node:https acepta certs en PEM directamente. AEAT exige autenticación
  // de cliente, sin este step el server responde 403.
  const agent = new https.Agent({
    cert: input.certPem,
    key: input.keyPem,
    passphrase: input.keyPassphrase,
    rejectUnauthorized: true,
    keepAlive: false,
  });

  return new Promise<VerifactuSendResult>((resolve) => {
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "",
          "Content-Length": Buffer.byteLength(envelope, "utf-8"),
          "User-Agent": "Prontara/1.0 Verifactu-Client",
        },
        agent,
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          const parsed = parseAeatResponse(res.statusCode || 0, body);
          resolve({
            ...parsed,
            rawResponse: body,
          });
        });
      },
    );

    req.on("error", (err) => {
      resolve({
        ok: false,
        status: "error",
        csvHuella: null,
        rawResponse: "",
        httpStatus: 0,
        errorMsg: "Error de red: " + err.message,
        errorCode: null,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        ok: false,
        status: "error",
        csvHuella: null,
        rawResponse: "",
        httpStatus: 0,
        errorMsg: "Timeout (30s) hablando con AEAT.",
        errorCode: null,
      });
    });

    req.write(envelope, "utf-8");
    req.end();
  });
}

/**
 * Indicador de si la configuración AEAT está completa (env vars + cert).
 * Lo usa /ajustes y health-check para mostrar estado.
 */
export function isVerifactuConfigured(): { ok: boolean; reason?: string } {
  const useProd = String(process.env.VERIFACTU_PROD || "").trim() === "true";
  const url = useProd
    ? (String(process.env.VERIFACTU_AEAT_URL_PROD || "").trim() || DEFAULT_URL_PROD)
    : (String(process.env.VERIFACTU_AEAT_URL_TEST || "").trim() || DEFAULT_URL_TEST);
  if (!url) return { ok: false, reason: "URL AEAT no configurada." };
  // El cert del firmante se lee del TenantCertificate (DB), no de env var.
  // Aquí solo validamos la parte de infraestructura.
  return { ok: true };
}
