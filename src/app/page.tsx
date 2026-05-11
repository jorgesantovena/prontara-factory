import { redirect } from "next/navigation";

/**
 * Home raíz del dominio (H13-A).
 *
 * Decisión de URL:
 *   /                  → Factory (panel CEO de SISPYME)
 *   /<vertical>        → home del ERP de un vertical (softwarefactory,
 *                        dental, veterinaria, colegio, peluqueria, …)
 *
 * Implementación: redirect server-side a /factory para no duplicar el
 * componente FactoryPage (600 líneas). Funcionalmente: el usuario teclea
 * `app.prontara.com` y aterriza en la Factory. La URL final que ve es
 * /factory.
 *
 * El home antiguo del tenant (HomeDashboard) se ha movido a
 * `src/app/[vertical]/page.tsx` y se accede vía `/softwarefactory`,
 * `/dental`, etc.
 */
export default function RootPage() {
  redirect("/factory");
}
