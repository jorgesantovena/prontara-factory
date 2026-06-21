import { describe, expect, it } from "vitest";
import {
  prefacturar,
  type Contrato,
  type Nivel,
  type Actividad,
  type ProyectoLite,
} from "../prefacturacion-engine";

/**
 * Caso B (excesos de horas) — modelo confirmado por Pedro (21-06):
 *   - Consumo = CONTADOR EN VIVO del contrato: un trigger lo sube con las
 *     horas de CADA Tarea al darla de alta (recalcularConsumoContratoDesdeTarea
 *     en api/erp/module). El motor lo LEE del campo, no lo recalcula por
 *     ventana. El exceso (Consumo − Bolsa − Facturadas) es acumulativo.
 *   - Bolsa (bono) INDEPENDIENTE del periodo (no se multiplica por los meses).
 *   - El exceso se reparte por proyecto del más caro al más barato; el DETALLE
 *     toma las Tareas de la ventana del periodo (N meses; "discreto" sin acotar).
 *
 * Anclaje numérico: Ejercicio 2 de Pedro = 1.465 €.
 *   Bono 10h. NUEDES (Programación, 61€/h, 15h) + SOPORTE (Soporte, 55€/h, 20h).
 *   Consumo 35, exceso 25 → Programación 15×61=915 (resto 10) +
 *   Soporte 10×55=550 = 1.465 €.
 */

const niveles: Nivel[] = [
  { tipoNivel: "M", subtipo: "S", modelo: "horas", bolsa: 0, precio: 50, servicio: "" }, // base
  { tipoNivel: "B", subtipo: "S", modelo: "horas", bolsa: 0, precio: 10 }, // bono = 10h
  { tipoNivel: "M", subtipo: "S", modelo: "horas", bolsa: 0, precio: 61, servicio: "Programacion" },
  { tipoNivel: "M", subtipo: "S", modelo: "horas", bolsa: 0, precio: 55, servicio: "Soporte" },
];

// Consumo = 35 (contador del contrato, mantenido por el trigger).
const contrato: Contrato = {
  id: "c1", codigo: "M1", cliente: "ACME", periodo: "mensual",
  tipoNivel: "M", subtipo: "S", consumo: 35, facturadas: 0, estado: "activo",
};

const proyectos: ProyectoLite[] = [
  { nombre: "NUEDES", id: "p1", contrato: "M1", codigoTipo: "Programacion" },
  { nombre: "SOPORTE", id: "p2", contrato: "M1", codigoTipo: "Soporte" },
];

function act(proyecto: string, fecha: string, horas: number): Actividad {
  return { id: proyecto + fecha, fecha, cliente: "ACME", proyecto, tiempoHoras: horas, estado: "" };
}

describe("prefacturacion Caso B — Pedro 21-06", () => {
  it("Ejercicio 2: exceso por proyecto del más caro al más barato = 1465€", () => {
    const actividades = [act("NUEDES", "2026-06-10", 15), act("SOPORTE", "2026-06-12", 20)];
    const lineas = prefacturar([contrato], niveles, "horas", "mensual", { fecha: "2026-06", actividades, proyectos });
    expect(lineas).toHaveLength(1);
    const l = lineas[0];
    expect(l.caso).toBe("B");
    expect(l.consumo).toBe(35); // del contador del contrato
    expect(l.bolsa).toBe(10);
    expect(l.horasAFacturar).toBeCloseTo(25, 5);
    expect(l.importe).toBeCloseTo(1465, 5);
  });

  it("el detalle por proyecto excluye Tareas fuera de la ventana (mensual)", () => {
    const actividades = [
      act("NUEDES", "2026-06-10", 15),
      act("SOPORTE", "2026-06-12", 20),
      act("NUEDES", "2026-03-01", 100), // fuera de la ventana mensual de 2026-06
    ];
    const lineas = prefacturar([contrato], niveles, "horas", "mensual", { fecha: "2026-06", actividades, proyectos });
    // El consumo (contador) no cambia, y el detalle no infla por la tarea de marzo.
    expect(lineas[0].importe).toBeCloseTo(1465, 5);
  });

  it("trimestral toma 3 meses para el detalle y la bolsa NO se multiplica", () => {
    const c3: Contrato = { ...contrato, periodo: "trimestral" };
    const actividades = [
      act("NUEDES", "2026-04-05", 5),
      act("NUEDES", "2026-06-10", 10), // Programación total = 15h
      act("SOPORTE", "2026-05-12", 20),
    ];
    const lineas = prefacturar([c3], niveles, "horas", "trimestral", { fecha: "2026-06", actividades, proyectos });
    expect(lineas).toHaveLength(1);
    expect(lineas[0].bolsa).toBe(10); // independiente del periodo
    expect(lineas[0].importe).toBeCloseTo(1465, 5);
  });

  it("sin exceso (Consumo ≤ Bolsa) no genera línea", () => {
    const sinExceso: Contrato = { ...contrato, consumo: 8 }; // 8 ≤ bono 10
    const lineas = prefacturar([sinExceso], niveles, "horas", "mensual", { fecha: "2026-06", actividades: [], proyectos });
    expect(lineas).toHaveLength(0);
  });
});
