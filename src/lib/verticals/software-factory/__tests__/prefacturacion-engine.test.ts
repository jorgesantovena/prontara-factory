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

/**
 * Mantenimiento contra errores (Tipo E) — Pedro 21-06 (P7): una cuota más POR
 * APLICACIÓN, periodificada al facturar (Valor anual × fracción del periodo) y
 * calculada en función del nº de aplicaciones. Un Tipo E NO genera cuota
 * genérica (Caso A) — solo sus líneas por aplicación.
 */
const nivelesE: Nivel[] = [
  { tipoNivel: "E", subtipo: "S", modelo: "cuota", bolsa: 0, precio: 1200, aplicacion: "APP1" }, // 1200 €/año
  { tipoNivel: "E", subtipo: "S", modelo: "cuota", bolsa: 0, precio: 2400, aplicacion: "APP2" }, // 2400 €/año
];
const contratoE: Contrato = {
  id: "e1", codigo: "E1", cliente: "ACME", periodo: "trimestral",
  tipoNivel: "E", subtipo: "S", consumo: 0, facturadas: 0, estado: "activo",
};
const acApps = [
  { contrato: "E1", aplicacion: "APP1" },
  { contrato: "E1", aplicacion: "APP2" },
];

/**
 * Caso A (Cuota) — Pedro 21-06: el Valor del Nivel Cuota es ANUAL y se
 * periodifica por la fracción del periodo del contrato (generaliza el Tipo E).
 */
describe("prefacturacion Caso A (Cuota anual periodificada) — Pedro 21-06", () => {
  const nivelesA: Nivel[] = [
    { tipoNivel: "A", subtipo: "A1", modelo: "cuota", bolsa: 0, precio: 1200 }, // 1200 €/año
  ];
  const base: Contrato = {
    id: "a1", codigo: "A1", cliente: "ACME", periodo: "mensual",
    tipoNivel: "A", subtipo: "A1", consumo: 0, facturadas: 0, estado: "activo",
  };

  it("mensual = Valor anual / 12", () => {
    const lineas = prefacturar([base], nivelesA, "cuota", "mensual", {});
    expect(lineas).toHaveLength(1);
    expect(lineas[0].importe).toBeCloseTo(100, 5); // 1200 / 12
  });

  it("trimestral = Valor anual / 4", () => {
    const c: Contrato = { ...base, periodo: "trimestral" };
    const lineas = prefacturar([c], nivelesA, "cuota", "trimestral", {});
    expect(lineas[0].importe).toBeCloseTo(300, 5); // 1200 / 4
  });

  it("anual = Valor íntegro", () => {
    const c: Contrato = { ...base, periodo: "anual" };
    const lineas = prefacturar([c], nivelesA, "cuota", "anual", {});
    expect(lineas[0].importe).toBeCloseTo(1200, 5);
  });
});

describe("prefacturacion Mantº Errores (Tipo E) — Pedro 21-06 P7", () => {
  it("trimestral: cuota por aplicación = Valor anual × 3/12, sin línea Caso A", () => {
    const lineas = prefacturar([contratoE], nivelesE, "cuota", "trimestral", { aplicacionesContrato: acApps });
    expect(lineas).toHaveLength(2); // solo Mantº Errores, NO una cuota genérica
    const total = lineas.reduce((s, l) => s + l.importe, 0);
    expect(total).toBeCloseTo(900, 5); // 1200×0.25 + 2400×0.25 = 300 + 600
  });

  it("mensual: misma cuota periodificada a 1/12", () => {
    const cMen: Contrato = { ...contratoE, periodo: "mensual" };
    const lineas = prefacturar([cMen], nivelesE, "cuota", "mensual", { aplicacionesContrato: acApps });
    expect(lineas).toHaveLength(2);
    const total = lineas.reduce((s, l) => s + l.importe, 0);
    expect(total).toBeCloseTo(300, 5); // 1200/12 + 2400/12 = 100 + 200
  });

  it("anual: cuota íntegra (factor 1) y escala con el nº de aplicaciones", () => {
    const cAnual: Contrato = { ...contratoE, periodo: "anual" };
    const lineas = prefacturar([cAnual], nivelesE, "cuota", "anual", { aplicacionesContrato: acApps });
    const total = lineas.reduce((s, l) => s + l.importe, 0);
    expect(total).toBeCloseTo(3600, 5); // 1200 + 2400
  });
});
