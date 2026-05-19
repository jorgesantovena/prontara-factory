import SectionPlaceholder from "@/components/erp/section-placeholder";

export default function NotificacionesPage() {
  return (
    <SectionPlaceholder
      title="Notificaciones"
      subtitle="Historial completo de notificaciones del tenant."
      hint="Aquí verás el listado completo con filtros por tipo (alertas, comerciales, sistema) y estado (leídas / no leídas). De momento, las notificaciones recientes aparecen en el panel del Inicio."
    />
  );
}
