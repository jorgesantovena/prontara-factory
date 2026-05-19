import SectionPlaceholder from "@/components/erp/section-placeholder";

export default function AuditoriaPage() {
  return (
    <SectionPlaceholder
      title="Actividad del tenant"
      subtitle="Auditoría completa: quién hizo qué y cuándo."
      hint="Aquí podrás consultar el log de cambios sobre cualquier módulo (creaciones, ediciones, borrados) con filtros por usuario, fecha y entidad. De momento, las últimas acciones aparecen en el panel del Inicio."
    />
  );
}
