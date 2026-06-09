/**
 * TEST 19 (Pedro) — Seed idempotente de Niveles + Contratos.
 *
 * Los demoData del sector pack solo se aplican al PROVISIONAR un tenant
 * nuevo. Los tenants que ya existían antes del TEST 19 (p.ej. el de
 * Pedro) ven Niveles y Contratos vacíos. Esta función los rellena de
 * forma idempotente y NO destructiva:
 *
 *   - 11 Niveles según TEST 19 (M1..M4 x cuota/horas, A-A1, B-B15, B-B20).
 *     Se insertan solo los que falten (clave compuesta tipo|subtipo|modelo).
 *   - N Contratos básicos, uno por cliente existente, SOLO si la tabla
 *     Contratos está vacía (para no pisar lo que el operador haya editado).
 *
 * Se invoca desde dos sitios:
 *   - El layout del vertical software-factory, automáticamente al entrar
 *     (Pedro no debe pulsar ningún botón).
 *   - El endpoint POST /api/erp/seed-test19 (botón manual en Ajustes,
 *     como respaldo).
 */

import {
  createModuleRecordAsync,
  listModuleRecordsAsync,
} from "@/lib/persistence/active-client-data-store-async";

export const NIVELES_SEED: Array<Record<string, string>> = [
  { tipoNivel: "M", subtipo: "1", modelo: "cuota", bolsa: "10", precio: "650",  descripcion: "Mantenimiento Nivel 1 — cuota anual 650€, bolsa 10h." },
  { tipoNivel: "M", subtipo: "1", modelo: "horas", bolsa: "0",  precio: "55",   descripcion: "Mantenimiento Nivel 1 — exceso 55€/h." },
  { tipoNivel: "M", subtipo: "2", modelo: "cuota", bolsa: "30", precio: "1200", descripcion: "Mantenimiento Nivel 2 — cuota mensual 1200€, bolsa 30h." },
  { tipoNivel: "M", subtipo: "2", modelo: "horas", bolsa: "0",  precio: "60",   descripcion: "Mantenimiento Nivel 2 — exceso 60€/h." },
  { tipoNivel: "M", subtipo: "3", modelo: "cuota", bolsa: "30", precio: "8400", descripcion: "Mantenimiento Nivel 3 — cuota anual 8400€, bolsa 30h." },
  { tipoNivel: "M", subtipo: "3", modelo: "horas", bolsa: "0",  precio: "65",   descripcion: "Mantenimiento Nivel 3 — exceso 65€/h." },
  { tipoNivel: "M", subtipo: "4", modelo: "cuota", bolsa: "60", precio: "2500", descripcion: "Mantenimiento Nivel 4 — cuota mensual 2500€, bolsa 60h." },
  { tipoNivel: "M", subtipo: "4", modelo: "horas", bolsa: "0",  precio: "70",   descripcion: "Mantenimiento Nivel 4 — exceso 70€/h." },
  { tipoNivel: "A", subtipo: "A1", modelo: "cuota", bolsa: "1", precio: "1800", descripcion: "Tarifa plana A1 — cuota trimestral 1800€." },
  { tipoNivel: "B", subtipo: "B15", modelo: "horas", bolsa: "15", precio: "60", descripcion: "Bono de 15h a 60€/h (900€ total)." },
  { tipoNivel: "B", subtipo: "B20", modelo: "horas", bolsa: "20", precio: "55", descripcion: "Bono de 20h a 55€/h (1100€ total)." },
];

function keyNivel(n: Record<string, string>): string {
  return String(n.tipoNivel || "").toUpperCase() + "|" + String(n.subtipo || "") + "|" + String(n.modelo || "").toLowerCase();
}

export interface EnsureTest19Result {
  niveles: number;
  nivelesYaExistentes: number;
  contratos: number;
  contratosYaExistentes: number;
}

/**
 * Siembra Niveles + Contratos de forma idempotente para `tenant`.
 * Devuelve cuántos creó. No lanza por datos faltantes (los `catch(() => [])`
 * asumen tabla vacía), pero sí puede lanzar si la persistencia falla en la
 * escritura — el llamador decide si tolerarlo.
 */
export async function ensureTest19Seed(tenant: string): Promise<EnsureTest19Result> {
  // 1) Niveles: insertar los que falten (idempotente por clave compuesta).
  const existentes = await listModuleRecordsAsync("niveles", tenant).catch(() => []);
  const setExist = new Set((existentes as Array<Record<string, string>>).map(keyNivel));
  let nivelesCreados = 0;
  for (const n of NIVELES_SEED) {
    if (setExist.has(keyNivel(n))) continue;
    await createModuleRecordAsync("niveles", n, tenant);
    nivelesCreados += 1;
  }

  // 2) Contratos: solo siembro si la tabla está vacía, para no pisar
  //    trabajos que el operador haya empezado a editar.
  const contratosExistentes = await listModuleRecordsAsync("contratos", tenant).catch(() => []);
  let contratosCreados = 0;
  if ((contratosExistentes as Array<Record<string, string>>).length === 0) {
    const clientes = await listModuleRecordsAsync("clientes", tenant).catch(() => []);
    const arrClientes = clientes as Array<Record<string, string>>;
    // Asignación por defecto: Mant M2 mensual al primer cliente, Mant M1
    // mensual al segundo, Bono B15 al tercero, Acuerdo A1 trimestral al
    // cuarto. Si hay más, ciclo de presets.
    const presets: Array<{ tipoNivel: string; subtipo: string; periodo: string; nota: string }> = [
      { tipoNivel: "M", subtipo: "2", periodo: "mensual",      nota: "Mantenimiento Nivel 2 mensual." },
      { tipoNivel: "M", subtipo: "1", periodo: "mensual",      nota: "Mantenimiento Nivel 1 mensual." },
      { tipoNivel: "B", subtipo: "B15", periodo: "discreto",   nota: "Bono 15h adicionales." },
      { tipoNivel: "A", subtipo: "A1", periodo: "trimestral",  nota: "Tarifa plana A1 trimestral." },
    ];
    let nSeq = 1;
    for (let i = 0; i < arrClientes.length; i++) {
      const cli = arrClientes[i];
      const preset = presets[i % presets.length];
      const codigo = "CON-2026-" + String(nSeq).padStart(3, "0");
      nSeq += 1;
      await createModuleRecordAsync("contratos", {
        codigo,
        cliente: String(cli.nombre || ""),
        periodo: preset.periodo,
        tipoNivel: preset.tipoNivel,
        subtipo: preset.subtipo,
        referenciaPropuesta: "",
        fechaInicio: "2026-01-01",
        fechaFin: "9999-12-31",
        estado: "activo",
        consumo: "",
        facturadas: "",
        notas: preset.nota,
      }, tenant);
      contratosCreados += 1;
    }
  }

  return {
    niveles: nivelesCreados,
    nivelesYaExistentes: (existentes as Array<Record<string, string>>).length,
    contratos: contratosCreados,
    contratosYaExistentes: (contratosExistentes as Array<Record<string, string>>).length,
  };
}
