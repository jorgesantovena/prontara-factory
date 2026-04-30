import type { NextRequest } from "next/server";
import { buildCommercialDeliveryPackageFromRequest } from "@/lib/commercial/commercial-composer";

export function buildDeliveryPreviewFromRequest(request: NextRequest) {
  const delivery = buildCommercialDeliveryPackageFromRequest(request);

  return {
    ok: true,
    delivery,
    cards: [
      {
        key: "access",
        title: "Acceso inmediato",
        detail:
          "URL de acceso preparada: " + delivery.access.accessUrl,
      },
      {
        key: "login",
        title: "Login del cliente",
        detail:
          "Entrada al ERP con branding del tenant: " + delivery.access.loginUrl,
      },
      {
        key: "wrapper",
        title: "Wrapper comercial",
        detail:
          "Instalable preparado: " + delivery.wrapper.installableName,
      },
      {
        key: "support",
        title: "Entrega entendible",
        detail:
          "El cliente recibe una experiencia clara desde el primer momento.",
      },
    ],
  };
}