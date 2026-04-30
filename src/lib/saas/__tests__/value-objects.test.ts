import { describe, it, expect } from "vitest";
import {
  parseEmail,
  parseEmailOrThrow,
  parseSlug,
  slugify,
  money,
  parseMoney,
  addMoney,
  multiplyMoney,
  formatMoney,
  parseBillingPlanKey,
  listBillingPlanKeys,
} from "@/lib/saas/value-objects";

describe("value-objects · Email", () => {
  it("acepta emails válidos y los normaliza", () => {
    expect(parseEmail("USER@Example.COM")).toBe("user@example.com");
    expect(parseEmail("  jorge@prontara.com  ")).toBe("jorge@prontara.com");
  });

  it("rechaza basura", () => {
    expect(parseEmail("")).toBeNull();
    expect(parseEmail("noatsign")).toBeNull();
    expect(parseEmail("a@b")).toBeNull(); // sin TLD
    expect(parseEmail(null)).toBeNull();
    expect(parseEmail(123)).toBeNull();
  });

  it("respeta longitud máxima RFC 5321", () => {
    const long = "a".repeat(250) + "@b.co";
    expect(parseEmail(long)).toBeNull();
  });

  it("parseEmailOrThrow lanza con valor inválido", () => {
    expect(() => parseEmailOrThrow("nope")).toThrow();
  });
});

describe("value-objects · Slug", () => {
  it("acepta slugs válidos", () => {
    expect(parseSlug("clinica-dental")).toBe("clinica-dental");
    expect(parseSlug("acme-2024")).toBe("acme-2024");
    expect(parseSlug("ab")).toBe("ab"); // mínimo 2 chars
  });

  it("rechaza slugs malformados", () => {
    expect(parseSlug("a")).toBeNull(); // < 2 chars
    expect(parseSlug("-leading")).toBeNull();
    expect(parseSlug("trailing-")).toBeNull();
    expect(parseSlug("doble--guion")).toBeNull();
    expect(parseSlug("Mayuscula")).toBeNull();
    expect(parseSlug("con espacio")).toBeNull();
    expect(parseSlug("acentós")).toBeNull();
  });

  it("slugify produce slugs válidos desde nombres reales", () => {
    expect(slugify("Clínica Dr. García")).toBe("clinica-dr-garcia");
    expect(slugify("  Taller   Mecánico  ")).toBe("taller-mecanico");
    expect(slugify("Niño & Niña SL")).toBe("nino-nina-sl");
  });

  it("slugify devuelve null si no queda nada útil", () => {
    expect(slugify("???")).toBeNull();
    expect(slugify("")).toBeNull();
  });
});

describe("value-objects · Money", () => {
  it("constructor acepta céntimos enteros y moneda válida", () => {
    const m = money(12500, "EUR");
    expect(m.cents).toBe(12500);
    expect(m.currency).toBe("EUR");
  });

  it("rechaza céntimos no enteros", () => {
    expect(() => money(12.5, "EUR")).toThrow(/enteros/);
  });

  it("rechaza céntimos negativos", () => {
    expect(() => money(-100, "EUR")).toThrow(/negativo/);
  });

  it("addMoney suma dos importes en misma moneda", () => {
    const sum = addMoney(money(1000, "EUR"), money(500, "EUR"));
    expect(sum.cents).toBe(1500);
  });

  it("addMoney lanza si las monedas difieren", () => {
    expect(() => addMoney(money(1000, "EUR"), money(500, "USD"))).toThrow(/monedas distintas/);
  });

  it("multiplyMoney multiplica por escalar entero", () => {
    const total = multiplyMoney(money(1200, "EUR"), 5);
    expect(total.cents).toBe(6000);
  });

  it("formatMoney da formato local", () => {
    const formatted = formatMoney(money(125000, "EUR"));
    // Locale es-ES: "1.250,00 €"
    expect(formatted).toMatch(/1[.,]?250[,.]00\s?€/);
  });

  it("parseMoney convierte input crudo o devuelve null", () => {
    expect(parseMoney({ cents: 100, currency: "EUR" })?.cents).toBe(100);
    expect(parseMoney({ cents: "100", currency: "EUR" })?.cents).toBe(100);
    expect(parseMoney({ cents: 100 })?.currency).toBe("EUR"); // default
    expect(parseMoney({ cents: -1 })).toBeNull();
    expect(parseMoney({ cents: 1.5 })).toBeNull();
    expect(parseMoney({ cents: 100, currency: "JPY" })).toBeNull();
  });
});

describe("value-objects · BillingPlanKey", () => {
  it("acepta los 4 planes válidos en cualquier capitalización", () => {
    expect(parseBillingPlanKey("trial")).toBe("trial");
    expect(parseBillingPlanKey("BASICO")).toBe("basico");
    expect(parseBillingPlanKey("  Estandar  ")).toBe("estandar");
    expect(parseBillingPlanKey("premium")).toBe("premium");
  });

  it("rechaza planes desconocidos o legacy", () => {
    expect(parseBillingPlanKey("starter")).toBeNull();
    expect(parseBillingPlanKey("pro")).toBeNull();
    expect(parseBillingPlanKey("")).toBeNull();
    expect(parseBillingPlanKey(null)).toBeNull();
  });

  it("listBillingPlanKeys devuelve los 4", () => {
    const list = listBillingPlanKeys();
    expect(list).toHaveLength(4);
    expect(list).toContain("trial");
    expect(list).toContain("premium");
  });
});
