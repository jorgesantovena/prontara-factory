/**
 * Generador del payload XML para Verifactu (SF-12, stub).
 *
 * Esto es una primera aproximación al esquema de envío de "Registro de
 * Alta de Factura" del sistema Verifactu de la AEAT. El XML resultante
 * NO se envía todavía — solo se prepara y se guarda en la tabla
 * VerifactuSubmission con status="prepared".
 *
 * Para llegar a producción real hace falta (ver docs/verifactu-pendientes.md):
 *   - Certificado digital de SISPYME S.L.
 *   - Firma XML-DSig del payload con ese certificado
 *   - URL real del web service AEAT (preproducción y producción)
 *   - Procesar respuesta: CSV de la huella y construir el QR
 *   - Tests con un sandbox AEAT (entorno preproducción)
 *
 * Esquema implementado aquí es un subset suficiente para que un
 * desarrollador con el certificado pueda firmar y enviar — los campos
 * obligatorios (NIF emisor/receptor, importe, fecha, descripción)
 * están todos.
 */

export type FacturaParaVerifactu = {
  numero: string;
  cliente: string;
  concepto: string;
  /** Importe total con IVA, formato "1234.56" */
  importeTotal: number;
  /** Importe base imponible. Si no se conoce, se calcula como total / (1+tipoIva). */
  baseImponible?: number;
  /** Tipo IVA aplicado (21, 10, 4...). Default 21. */
  tipoIva?: number;
  fechaEmision: string;
};

export type EmisorData = {
  /** Razón social del emisor (la sociedad que factura — SISPYME S.L. para Prontara). */
  razonSocial: string;
  /** CIF/NIF del emisor */
  nif: string;
};

export type ReceptorData = {
  /** Razón social del cliente */
  razonSocial: string;
  /** CIF/NIF del cliente — opcional en factura simplificada (<3000 EUR), obligatorio en factura completa */
  nif?: string;
};

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseImporteEur(raw: string): number {
  if (!raw) return 0;
  const match = String(raw).match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const n = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Construye el XML de envío Verifactu para una factura. NO firma; el
 * resultado debe pasar por la firma XML-DSig antes de enviarse a AEAT.
 */
export function buildVerifactuPayload(
  factura: FacturaParaVerifactu,
  emisor: EmisorData,
  receptor: ReceptorData,
): string {
  const tipoIva = factura.tipoIva ?? 21;
  const total = factura.importeTotal;
  const base =
    factura.baseImponible != null
      ? factura.baseImponible
      : Math.round((total / (1 + tipoIva / 100)) * 100) / 100;
  const cuotaIva = Math.round((total - base) * 100) / 100;

  const fmt = (n: number) => n.toFixed(2);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<RegistroAltaFactura xmlns="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikev/modelos/suministros/v1.0/SuministrosVerifactu.xsd">',
    "  <IDFactura>",
    "    <IDEmisorFactura>",
    "      <NIF>" + escapeXml(emisor.nif) + "</NIF>",
    "    </IDEmisorFactura>",
    "    <NumSerieFactura>" + escapeXml(factura.numero) + "</NumSerieFactura>",
    "    <FechaExpedicion>" + escapeXml(factura.fechaEmision) + "</FechaExpedicion>",
    "  </IDFactura>",
    "  <NombreRazonEmisor>" + escapeXml(emisor.razonSocial) + "</NombreRazonEmisor>",
    "  <TipoFactura>F1</TipoFactura>",
    "  <DescripcionOperacion>" + escapeXml(factura.concepto) + "</DescripcionOperacion>",
    "  <Destinatario>",
    "    <NombreRazon>" + escapeXml(receptor.razonSocial) + "</NombreRazon>",
    receptor.nif ? "    <NIF>" + escapeXml(receptor.nif) + "</NIF>" : "",
    "  </Destinatario>",
    "  <Desglose>",
    "    <DesgloseFactura>",
    "      <Sujeta>",
    "        <NoExenta>",
    "          <TipoNoExenta>S1</TipoNoExenta>",
    "          <DesgloseIVA>",
    "            <DetalleIVA>",
    "              <TipoImpositivo>" + tipoIva + "</TipoImpositivo>",
    "              <BaseImponible>" + fmt(base) + "</BaseImponible>",
    "              <CuotaRepercutida>" + fmt(cuotaIva) + "</CuotaRepercutida>",
    "            </DetalleIVA>",
    "          </DesgloseIVA>",
    "        </NoExenta>",
    "      </Sujeta>",
    "    </DesgloseFactura>",
    "  </Desglose>",
    "  <ImporteTotal>" + fmt(total) + "</ImporteTotal>",
    "</RegistroAltaFactura>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Helper para extraer importe numérico de un string del módulo
 * facturacion (donde se guarda como "4500 EUR").
 */
export function extractImporteFromFactura(raw: string): number {
  return parseImporteEur(raw);
}
