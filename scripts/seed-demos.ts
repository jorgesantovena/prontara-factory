/**
 * Script seed-demos (H14-B) — siembra 3 tenants demo presentables.
 *
 * Crea tenants con slugs semánticos:
 *   - clinica-dental-demo  → vertical clinica-dental
 *   - colegio-demo          → vertical colegio
 *   - peluqueria-demo       → vertical peluqueria
 *
 * Cada uno con datos realistas:
 *   - 8-12 clientes/pacientes/alumnos
 *   - 5-8 proyectos/citas/tratamientos
 *   - 4-6 facturas (mezcla cobradas/pendientes)
 *   - 3-5 tareas pendientes
 *   - Productos / catálogo donde aplica
 *
 * Uso:
 *   pnpm exec tsx scripts/seed-demos.ts
 *   pnpm exec tsx scripts/seed-demos.ts --only=dental
 *   pnpm exec tsx scripts/seed-demos.ts --reset    (borra y recrea)
 *
 * Variables de entorno necesarias:
 *   PRONTARA_SESSION_SECRET    (>=32 chars)
 *   PRONTARA_PERSISTENCE       (filesystem o postgres)
 *   DATABASE_URL               (si persistence=postgres)
 */

import { createTenantFromAlta } from "../src/lib/saas/tenant-creation";
import { createModuleRecordAsync } from "../src/lib/persistence/active-client-data-store-async";

type DemoSpec = {
  slug: string;
  displayName: string;
  sector: string;
  businessType: string;
  adminEmail: string;
  adminFullName: string;
  records: Array<{ moduleKey: string; payload: Record<string, unknown> }>;
};

// ─── Datos realistas para cada vertical ─────────────────────────────

const DENTAL: DemoSpec = {
  slug: "clinica-dental-demo",
  displayName: "Clínica Dental Demo",
  sector: "salud",
  businessType: "clinica-dental",
  adminEmail: "demo@clinica-dental-demo.com",
  adminFullName: "Dra. María García",
  records: [
    // Pacientes
    { moduleKey: "clientes", payload: { nombre: "Ana Rodríguez Pérez", telefono: "+34 612 345 678", email: "ana.rodriguez@email.com", fecha_nacimiento: "1985-03-12", alergias: "Penicilina", doctor_referente: "Dr. Sánchez", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Carlos Martín López", telefono: "+34 654 123 987", email: "carlos.martin@email.com", fecha_nacimiento: "1978-07-22", alergias: "Ninguna", doctor_referente: "Dra. García", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Laura Fernández Ruiz", telefono: "+34 698 765 432", email: "laura.fr@email.com", fecha_nacimiento: "1992-11-04", alergias: "Látex", doctor_referente: "Dr. Sánchez", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Javier Torres Gil", telefono: "+34 633 222 111", email: "javier.torres@email.com", fecha_nacimiento: "1965-01-30", alergias: "Ibuprofeno", doctor_referente: "Dra. García", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Elena Navarro Vidal", telefono: "+34 677 888 999", email: "elena.nv@email.com", fecha_nacimiento: "2001-05-18", alergias: "Ninguna", doctor_referente: "Dr. Sánchez", estado: "nuevo" } },
    { moduleKey: "clientes", payload: { nombre: "Roberto Vega Castro", telefono: "+34 611 555 444", email: "roberto.vega@email.com", fecha_nacimiento: "1958-09-25", alergias: "Aspirina, polen", doctor_referente: "Dra. García", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Sofía Ramírez Blanco", telefono: "+34 622 333 444", email: "sofia.rb@email.com", fecha_nacimiento: "1988-12-08", alergias: "Ninguna", doctor_referente: "Dr. Sánchez", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Diego Ortiz Mendoza", telefono: "+34 699 111 222", email: "diego.om@email.com", fecha_nacimiento: "1995-04-15", alergias: "Ninguna", doctor_referente: "Dra. García", estado: "inactivo" } },
    // Tratamientos / citas
    { moduleKey: "proyectos", payload: { nombre: "Ortodoncia invisible — Ana Rodríguez", tipo: "tratamiento", fecha: "2026-05-12 10:00", cliente: "Ana Rodríguez Pérez", doctor: "Dra. García", estado: "en_marcha", duracion: "18 meses" } },
    { moduleKey: "proyectos", payload: { nombre: "Implante dental — Carlos Martín", tipo: "tratamiento", fecha: "2026-05-15 11:30", cliente: "Carlos Martín López", doctor: "Dr. Sánchez", estado: "planificado", duracion: "3 sesiones" } },
    { moduleKey: "proyectos", payload: { nombre: "Limpieza dental — Laura Fernández", tipo: "cita", fecha: "2026-05-11 09:00", cliente: "Laura Fernández Ruiz", doctor: "Dra. García", estado: "completado", duracion: "30 min" } },
    { moduleKey: "proyectos", payload: { nombre: "Endodoncia — Roberto Vega", tipo: "tratamiento", fecha: "2026-05-13 16:30", cliente: "Roberto Vega Castro", doctor: "Dr. Sánchez", estado: "en_marcha", duracion: "2 sesiones" } },
    { moduleKey: "proyectos", payload: { nombre: "Blanqueamiento — Sofía Ramírez", tipo: "tratamiento", fecha: "2026-05-14 12:00", cliente: "Sofía Ramírez Blanco", doctor: "Dra. García", estado: "planificado", duracion: "1 hora" } },
    { moduleKey: "proyectos", payload: { nombre: "Revisión general — Elena Navarro", tipo: "cita", fecha: "2026-05-11 17:00", cliente: "Elena Navarro Vidal", doctor: "Dr. Sánchez", estado: "completado", duracion: "20 min" } },
    // Presupuestos
    { moduleKey: "presupuestos", payload: { numero: "PRE-DEN-001", cliente: "Carlos Martín López", concepto: "Implante dental superior derecho — fases 1-3", importe: "2400", estado: "firmado", fecha_firma: "2026-04-28" } },
    { moduleKey: "presupuestos", payload: { numero: "PRE-DEN-002", cliente: "Ana Rodríguez Pérez", concepto: "Ortodoncia Invisalign — tratamiento completo 18 meses", importe: "3800", estado: "firmado", fecha_firma: "2026-03-15" } },
    { moduleKey: "presupuestos", payload: { numero: "PRE-DEN-003", cliente: "Sofía Ramírez Blanco", concepto: "Blanqueamiento dental profesional", importe: "350", estado: "enviado", fecha_firma: "" } },
    { moduleKey: "presupuestos", payload: { numero: "PRE-DEN-004", cliente: "Roberto Vega Castro", concepto: "Endodoncia molar inferior + corona porcelana", importe: "780", estado: "firmado", fecha_firma: "2026-05-02" } },
    // Facturas
    { moduleKey: "facturacion", payload: { numero: "FAC-DEN-2026-001", cliente: "Ana Rodríguez Pérez", concepto: "Ortodoncia Invisalign — fase 1", importe: "1200", estado: "cobrada" } },
    { moduleKey: "facturacion", payload: { numero: "FAC-DEN-2026-002", cliente: "Carlos Martín López", concepto: "Implante dental — fase 1", importe: "800", estado: "cobrada" } },
    { moduleKey: "facturacion", payload: { numero: "FAC-DEN-2026-003", cliente: "Laura Fernández Ruiz", concepto: "Limpieza dental", importe: "65", estado: "cobrada" } },
    { moduleKey: "facturacion", payload: { numero: "FAC-DEN-2026-004", cliente: "Roberto Vega Castro", concepto: "Endodoncia — primera sesión", importe: "260", estado: "emitida" } },
    { moduleKey: "facturacion", payload: { numero: "FAC-DEN-2026-005", cliente: "Diego Ortiz Mendoza", concepto: "Revisión + radiografía", importe: "85", estado: "vencida" } },
    // Tareas
    { moduleKey: "tareas", payload: { titulo: "Llamar a Carlos Martín para confirmar cita implante", asignado: "Recepción", prioridad: "alta", fechaLimite: "2026-05-12", estado: "pendiente" } },
    { moduleKey: "tareas", payload: { titulo: "Pedir material ortodoncia — proveedor Invisalign", asignado: "Dra. García", prioridad: "media", fechaLimite: "2026-05-13", estado: "pendiente" } },
    { moduleKey: "tareas", payload: { titulo: "Reclamar factura vencida Diego Ortiz", asignado: "Administración", prioridad: "alta", fechaLimite: "2026-05-11", estado: "pendiente" } },
    { moduleKey: "tareas", payload: { titulo: "Renovar póliza seguro responsabilidad civil", asignado: "Dra. García", prioridad: "baja", fechaLimite: "2026-06-01", estado: "pendiente" } },
  ],
};

const COLEGIO: DemoSpec = {
  slug: "colegio-demo",
  displayName: "Colegio San Vicente — Demo",
  sector: "educacion",
  businessType: "colegio",
  adminEmail: "demo@colegio-demo.com",
  adminFullName: "Lucía Hernández (Dirección)",
  records: [
    // Alumnos
    { moduleKey: "clientes", payload: { nombre: "Marcos Alonso Pérez", telefono: "+34 654 100 200", email: "familia.alonso@email.com", curso: "3º ESO", grupo: "A", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Lucía Castro Vega", telefono: "+34 654 100 201", email: "familia.castro@email.com", curso: "5º Primaria", grupo: "B", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Pablo Romero Sánchez", telefono: "+34 654 100 202", email: "familia.romero@email.com", curso: "1º Bachillerato", grupo: "A", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Carmen Torres Gil", telefono: "+34 654 100 203", email: "familia.torres@email.com", curso: "4º ESO", grupo: "C", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Daniel Vargas Ríos", telefono: "+34 654 100 204", email: "familia.vargas@email.com", curso: "2º ESO", grupo: "B", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Isabel Núñez Cruz", telefono: "+34 654 100 205", email: "familia.nunez@email.com", curso: "6º Primaria", grupo: "A", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Adrián Méndez Soto", telefono: "+34 654 100 206", email: "familia.mendez@email.com", curso: "3º Primaria", grupo: "B", estado: "activo" } },
    { moduleKey: "clientes", payload: { nombre: "Valeria Iglesias Bravo", telefono: "+34 654 100 207", email: "familia.iglesias@email.com", curso: "2º Bachillerato", grupo: "A", estado: "activo" } },
    // Comunicaciones
    { moduleKey: "comunicaciones", payload: { asunto: "Reunión trimestral familias 3º ESO", destinatario: "Familias 3º ESO", canal: "email", estado: "enviada", fecha: "2026-05-08" } },
    { moduleKey: "comunicaciones", payload: { asunto: "Excursión Museo del Prado — autorización", destinatario: "Familias 6º Primaria", canal: "circular", estado: "enviada", fecha: "2026-05-06" } },
    { moduleKey: "comunicaciones", payload: { asunto: "Recordatorio cuota mensual mayo", destinatario: "Todas las familias", canal: "email", estado: "programada", fecha: "2026-05-15" } },
    // Facturas (cuotas)
    { moduleKey: "facturacion", payload: { numero: "FAC-COL-2026-04-001", cliente: "Marcos Alonso Pérez", concepto: "Cuota mensual abril — 3º ESO", importe: "450", estado: "cobrada" } },
    { moduleKey: "facturacion", payload: { numero: "FAC-COL-2026-04-002", cliente: "Lucía Castro Vega", concepto: "Cuota mensual abril — 5º Primaria", importe: "380", estado: "cobrada" } },
    { moduleKey: "facturacion", payload: { numero: "FAC-COL-2026-04-003", cliente: "Pablo Romero Sánchez", concepto: "Cuota mensual abril — Bachillerato", importe: "520", estado: "vencida" } },
    { moduleKey: "facturacion", payload: { numero: "FAC-COL-2026-04-004", cliente: "Daniel Vargas Ríos", concepto: "Cuota mensual abril + transporte", importe: "480", estado: "vencida" } },
    // Tareas
    { moduleKey: "tareas", payload: { titulo: "Reclamar cuotas vencidas (Pablo, Daniel)", asignado: "Administración", prioridad: "alta", fechaLimite: "2026-05-12", estado: "pendiente" } },
    { moduleKey: "tareas", payload: { titulo: "Preparar acta consejo escolar trimestre", asignado: "Lucía Hernández", prioridad: "media", fechaLimite: "2026-05-20", estado: "pendiente" } },
    { moduleKey: "tareas", payload: { titulo: "Renovar contrato comedor curso 2026-27", asignado: "Dirección", prioridad: "alta", fechaLimite: "2026-05-30", estado: "pendiente" } },
  ],
};

const PELUQUERIA: DemoSpec = {
  slug: "peluqueria-demo",
  displayName: "Salón Bella Demo",
  sector: "belleza",
  businessType: "peluqueria",
  adminEmail: "demo@peluqueria-demo.com",
  adminFullName: "Patricia Salón",
  records: [
    // Clientas
    { moduleKey: "clientes", payload: { nombre: "Beatriz Soler", telefono: "+34 678 111 222", email: "beatriz.soler@email.com", estado: "activo", segmento: "frecuente" } },
    { moduleKey: "clientes", payload: { nombre: "Marta Giménez", telefono: "+34 678 111 223", email: "marta.gim@email.com", estado: "activo", segmento: "vip" } },
    { moduleKey: "clientes", payload: { nombre: "Cristina León", telefono: "+34 678 111 224", email: "cristina.leon@email.com", estado: "activo", segmento: "frecuente" } },
    { moduleKey: "clientes", payload: { nombre: "Andrea Pinto", telefono: "+34 678 111 225", email: "andrea.pinto@email.com", estado: "activo", segmento: "ocasional" } },
    { moduleKey: "clientes", payload: { nombre: "Sara Méndez", telefono: "+34 678 111 226", email: "sara.mendez@email.com", estado: "activo", segmento: "vip" } },
    { moduleKey: "clientes", payload: { nombre: "Patricia Núñez", telefono: "+34 678 111 227", email: "patricia.nu@email.com", estado: "activo", segmento: "frecuente" } },
    // Citas
    { moduleKey: "proyectos", payload: { nombre: "Corte + tinte — Beatriz", tipo: "cita", fecha: "2026-05-11 10:30", cliente: "Beatriz Soler", profesional: "Lucía", estado: "completado", duracion: "1h 30min" } },
    { moduleKey: "proyectos", payload: { nombre: "Mechas — Marta", tipo: "cita", fecha: "2026-05-11 12:00", cliente: "Marta Giménez", profesional: "Patricia", estado: "completado", duracion: "2h" } },
    { moduleKey: "proyectos", payload: { nombre: "Corte caballero — Cristina", tipo: "cita", fecha: "2026-05-12 09:30", cliente: "Cristina León", profesional: "Lucía", estado: "planificado", duracion: "30 min" } },
    { moduleKey: "proyectos", payload: { nombre: "Tratamiento botox capilar — Sara", tipo: "cita", fecha: "2026-05-12 16:00", cliente: "Sara Méndez", profesional: "Patricia", estado: "planificado", duracion: "1h" } },
    // Caja
    { moduleKey: "caja", payload: { ticket: "T-001", concepto: "Corte + tinte", importe: "65", metodoPago: "tarjeta", cliente: "Beatriz Soler", fecha: "2026-05-11", cajero: "Lucía", estado: "cerrado" } },
    { moduleKey: "caja", payload: { ticket: "T-002", concepto: "Mechas + producto", importe: "120", metodoPago: "tarjeta", cliente: "Marta Giménez", fecha: "2026-05-11", cajero: "Patricia", estado: "cerrado" } },
    { moduleKey: "caja", payload: { ticket: "T-003", concepto: "Venta champú profesional", importe: "28", metodoPago: "efectivo", cliente: "", fecha: "2026-05-11", cajero: "Lucía", estado: "cerrado" } },
    // Productos
    { moduleKey: "productos", payload: { sku: "CHA-001", nombre: "Champú reparador Olaplex", categoria: "Cuidado capilar", tipo: "producto", precio: "28", unidadMedida: "ud", stock: "8", estado: "activo" } },
    { moduleKey: "productos", payload: { sku: "TIN-RU01", nombre: "Tinte rubio platino L'Oréal", categoria: "Coloración", tipo: "consumible", precio: "12", unidadMedida: "ud", stock: "3", estado: "activo" } },
    { moduleKey: "productos", payload: { sku: "MAS-001", nombre: "Mascarilla hidratante Kerastase", categoria: "Cuidado capilar", tipo: "producto", precio: "35", unidadMedida: "ud", stock: "5", estado: "activo" } },
    // Facturas
    { moduleKey: "facturacion", payload: { numero: "FAC-PEL-2026-001", cliente: "Marta Giménez", concepto: "Mechas + producto Olaplex", importe: "148", estado: "cobrada" } },
    { moduleKey: "facturacion", payload: { numero: "FAC-PEL-2026-002", cliente: "Sara Méndez", concepto: "Tratamiento botox capilar", importe: "85", estado: "emitida" } },
    // Tareas
    { moduleKey: "tareas", payload: { titulo: "Pedir tinte rubio platino — stock bajo", asignado: "Patricia", prioridad: "alta", fechaLimite: "2026-05-12", estado: "pendiente" } },
    { moduleKey: "tareas", payload: { titulo: "Confirmar citas mañana por WhatsApp", asignado: "Lucía", prioridad: "media", fechaLimite: "2026-05-11", estado: "pendiente" } },
  ],
};

const ALL_DEMOS: Record<string, DemoSpec> = {
  dental: DENTAL,
  colegio: COLEGIO,
  peluqueria: PELUQUERIA,
};

// ─── Runner ──────────────────────────────────────────────────────────

async function seedDemo(spec: DemoSpec): Promise<void> {
  console.log("\n━━━ " + spec.displayName + " (" + spec.slug + ") ━━━");

  const result = await createTenantFromAlta({
    desiredSlug: spec.slug,
    companyName: spec.displayName,
    contactName: spec.adminFullName,
    email: spec.adminEmail,
    sector: spec.sector,
    businessType: spec.businessType,
    companySize: "small",
  });

  if (!result.ok) {
    const errs = Array.isArray(result.errors) ? result.errors.join(", ") : "(sin detalle)";
    console.error("  ✗ Failed to create tenant:", errs);
    return;
  }

  console.log("  ✓ Tenant creado");
  console.log("    clientId:  " + result.clientId);
  console.log("    slug:      " + result.slug);
  console.log("    admin:     " + spec.adminEmail);
  console.log("    password:  " + result.temporaryPassword);
  console.log("    activate:  " + result.activationUrl);

  let inserted = 0;
  for (const record of spec.records) {
    try {
      await createModuleRecordAsync(record.moduleKey, record.payload, result.clientId);
      inserted++;
    } catch (e) {
      console.error("    ✗ Error insertando en " + record.moduleKey + ":", e instanceof Error ? e.message : String(e));
    }
  }
  console.log("  ✓ " + inserted + "/" + spec.records.length + " registros sembrados");
  console.log("  → URL del ERP: /" + spec.businessType.replace(/-/g, "").replace("clinica", "") + " (tras login)");
}

async function main() {
  const args = process.argv.slice(2);
  const onlyMatch = args.find((a) => a.startsWith("--only="));
  const only = onlyMatch ? onlyMatch.split("=")[1] : null;

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Prontara Factory · Seed de demos (H14-B)               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("Persistencia: " + (process.env.PRONTARA_PERSISTENCE || "filesystem"));
  if (only) console.log("Filtro: --only=" + only);

  const todo = only ? [ALL_DEMOS[only]].filter(Boolean) : Object.values(ALL_DEMOS);
  if (todo.length === 0) {
    console.error("\nNo demos a sembrar. --only debe ser uno de: " + Object.keys(ALL_DEMOS).join(", "));
    process.exit(1);
  }

  for (const spec of todo) {
    try {
      await seedDemo(spec);
    } catch (e) {
      console.error("\n✗ Fatal en " + spec.slug + ":", e instanceof Error ? e.stack : String(e));
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✓ Seed completado. Ya puedes acceder a los demos:");
  for (const spec of todo) {
    console.log("  · " + spec.displayName + ":");
    console.log("      email:    " + spec.adminEmail);
    console.log("      (la contraseña temporal está arriba en cada log)");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
