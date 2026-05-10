/**
 * Generador de fichero SEPA Direct Debit pain.008.001.02 (H8.5-SEPA).
 *
 * Implementa el esquema ISO 20022 que aceptan los bancos españoles para
 * presentar remesas de recibos domiciliados. Soporta los 3 tipos:
 *
 *   - CORE (B2C): cobros a particulares. Refund window 8 semanas.
 *   - B2B: cobros entre empresas. No hay refund. Mandato registrado en banco.
 *   - COR1: variante CORE con D-1 (no la implementamos, raro hoy).
 *
 * Y los 3 secuencias de mandato:
 *
 *   - FRST: primer cobro de un mandato recurrente
 *   - RCUR: cobros recurrentes posteriores
 *   - OOFF: mandato único (no se vuelve a cobrar)
 *   - FNAL: último cobro y se cancela el mandato
 *
 * Uso:
 *   const xml = buildSepaDirectDebit({
 *     emisor: { nombre, nif, iban, bic },
 *     remesaId: "REM-2026-001",
 *     fechaCobro: "2026-06-05",
 *     tipo: "CORE",
 *     secuencia: "RCUR",
 *     cobros: [{ deudor, iban, bic, mandatoRef, mandatoFecha, importe, concepto }, ...]
 *   });
 *
 * El XML resultante se sube tal cual al portal del banco (BBVA, Santander,
 * CaixaBank, Sabadell, ING — todos aceptan el estándar).
 *
 * NO genera firma — los bancos firman al recibir y validar.
 */

export type SepaTipo = "CORE" | "B2B";
export type SepaSecuencia = "FRST" | "RCUR" | "OOFF" | "FNAL";

export type SepaEmisor = {
  /** Razón social del acreedor (quien cobra) */
  nombre: string;
  /** CIF del acreedor */
  nif: string;
  /** IBAN destino (donde llega el dinero) */
  iban: string;
  /** BIC del IBAN del acreedor (opcional pero recomendado) */
  bic?: string;
  /** Identificador del acreedor SEPA. Para España: ESxx ZZZ NIF (sin espacios). Si vacío, se calcula. */
  creditorId?: string;
};

export type SepaCobro = {
  /** Razón social del deudor */
  deudor: string;
  /** IBAN del deudor */
  iban: string;
  /** BIC del deudor (opcional) */
  bic?: string;
  /** Referencia del mandato firmado por el deudor */
  mandatoRef: string;
  /** Fecha firma del mandato (YYYY-MM-DD) */
  mandatoFecha: string;
  /** Importe en EUR */
  importe: number;
  /** Concepto que aparecerá en el extracto del deudor (max 140 chars) */
  concepto: string;
  /** Referencia interna (opcional, para reconciliación tras cobro) */
  refInterna?: string;
};

export type SepaInput = {
  emisor: SepaEmisor;
  remesaId: string;
  /** Fecha solicitada de cobro (YYYY-MM-DD) */
  fechaCobro: string;
  tipo: SepaTipo;
  secuencia: SepaSecuencia;
  cobros: SepaCobro[];
};

/**
 * Calcula el identificador del acreedor SEPA español a partir del NIF.
 * Formato: ES + 2 dígitos control + ZZZ + NIF (sin espacios ni guiones).
 * Si el caller ya tiene su creditorId oficial, lo usamos.
 */
export function buildSpanishCreditorId(nif: string): string {
  const cleanNif = nif.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  // Cálculo simplificado del dígito de control mod 97 — para producción
  // recomendamos usar el creditorId que el banco da al alta, no calcular.
  const baseStr = cleanNif + "ES00";
  let n = "";
  for (const c of baseStr) {
    if (c >= "A" && c <= "Z") n += String(c.charCodeAt(0) - 55);
    else n += c;
  }
  // mod 97
  let mod = 0;
  for (const d of n) mod = (mod * 10 + parseInt(d, 10)) % 97;
  const check = String(98 - mod).padStart(2, "0");
  return "ES" + check + "ZZZ" + cleanNif;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

export function buildSepaDirectDebit(input: SepaInput): string {
  if (input.cobros.length === 0) throw new Error("SEPA: sin cobros.");
  if (input.cobros.length > 999_999) throw new Error("SEPA: máximo 999999 cobros por remesa.");

  const creditorId = input.emisor.creditorId || buildSpanishCreditorId(input.emisor.nif);
  const totalImporte = input.cobros.reduce((s, c) => s + c.importe, 0);
  const numTx = input.cobros.length;
  const msgId = (input.remesaId + "-" + Date.now()).slice(0, 35);
  const pmtInfId = (input.remesaId + "-PMT-" + input.secuencia).slice(0, 35);
  const creationDateTime = new Date().toISOString().slice(0, 19);
  const lcl = input.tipo === "B2B" ? "B2B" : "CORE";
  const svcLvl = "SEPA";

  const txBlocks = input.cobros.map((c, i) => {
    const endToEndId = (c.refInterna || (input.remesaId + "-" + (i + 1))).slice(0, 35);
    return `      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${fmt2(c.importe)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escapeXml(c.mandatoRef)}</MndtId>
            <DtOfSgntr>${escapeXml(c.mandatoFecha)}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>${c.bic ? `<BIC>${escapeXml(c.bic)}</BIC>` : "<Othr><Id>NOTPROVIDED</Id></Othr>"}</FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${escapeXml(c.deudor.slice(0, 70))}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id><IBAN>${cleanIban(c.iban)}</IBAN></Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(c.concepto.slice(0, 140))}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>${creationDateTime}</CreDtTm>
      <NbOfTxs>${numTx}</NbOfTxs>
      <CtrlSum>${fmt2(totalImporte)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(input.emisor.nombre.slice(0, 70))}</Nm>
        <Id>
          <OrgId>
            <Othr>
              <Id>${escapeXml(creditorId)}</Id>
            </Othr>
          </OrgId>
        </Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(pmtInfId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${numTx}</NbOfTxs>
      <CtrlSum>${fmt2(totalImporte)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>${svcLvl}</Cd></SvcLvl>
        <LclInstrm><Cd>${lcl}</Cd></LclInstrm>
        <SeqTp>${input.secuencia}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${input.fechaCobro}</ReqdColltnDt>
      <Cdtr>
        <Nm>${escapeXml(input.emisor.nombre.slice(0, 70))}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id><IBAN>${cleanIban(input.emisor.iban)}</IBAN></Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>${input.emisor.bic ? `<BIC>${escapeXml(input.emisor.bic)}</BIC>` : "<Othr><Id>NOTPROVIDED</Id></Othr>"}</FinInstnId>
      </CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${escapeXml(creditorId)}</Id>
              <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
${txBlocks}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>
`;
}

/**
 * Validación IBAN básica (longitud + checksum mod 97).
 */
export function isValidIban(iban: string): boolean {
  const clean = cleanIban(iban);
  if (clean.length < 15 || clean.length > 34) return false;
  if (!/^[A-Z0-9]+$/.test(clean)) return false;
  // Mover los 4 primeros caracteres al final
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  // Convertir letras a números (A=10, B=11, ...)
  let numStr = "";
  for (const c of rearranged) {
    if (c >= "A" && c <= "Z") numStr += String(c.charCodeAt(0) - 55);
    else numStr += c;
  }
  // mod 97
  let mod = 0;
  for (const d of numStr) mod = (mod * 10 + parseInt(d, 10)) % 97;
  return mod === 1;
}
