"use client";

/**
 * Botón "↓ PDF" para cada fila de presupuestos / facturas / pedidos / etc.
 * Abre el PDF generado por /api/erp/business-document-pdf en una pestaña
 * nueva. La plantilla del PDF es la misma para todos los verticales — el
 * título del documento y los datos del emisor cambian según el tenant.
 *
 * AUDIT-06.
 */

type Row = Record<string, string>;

type Props = {
  modulo: "facturacion" | "presupuestos" | "pedidos" | "albaranes";
  row: Row;
  /** Etiqueta visible. Default según módulo. */
  label?: string;
  /** Override opcional del título que aparece dentro del PDF (ej. "BONO" en
   *  vez de "PRESUPUESTO" en gimnasio si quisieras forzarlo, aunque por
   *  defecto el endpoint deduce del módulo). */
  tituloOverride?: string;
};

const DEFAULT_LABEL: Record<string, string> = {
  facturacion: "↓ PDF",
  presupuestos: "↓ PDF",
  pedidos: "↓ PDF",
  albaranes: "↓ PDF",
};

export default function DownloadDocumentButton({
  modulo,
  row,
  label,
  tituloOverride,
}: Props) {
  const id = String(row?.id || "").trim();
  if (!id) return null;

  const params = new URLSearchParams({ modulo, id });
  if (tituloOverride) params.set("titulo", tituloOverride);
  const href = "/api/erp/business-document-pdf?" + params.toString();
  const labelToShow = label || DEFAULT_LABEL[modulo] || "↓ PDF";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title="Descargar el PDF de este documento"
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 6,
        background: "#ffffff",
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: "#1d4ed8",
        textDecoration: "none",
        marginRight: 6,
        display: "inline-block",
      }}
    >
      {labelToShow}
    </a>
  );
}
