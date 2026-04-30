import { describe, it, expect } from "vitest";
import {
  CONTRACT_PROVIDER,
  CONTRACT_PLAN_LABEL,
  CONTRACT_PLAN_FEATURES,
  formatContractEuros,
  formatContractDate,
} from "@/lib/saas/contract-content";

describe("contract-content", () => {
  describe("CONTRACT_PROVIDER", () => {
    it("debe contener los datos legales de SISPYME", () => {
      expect(CONTRACT_PROVIDER.legalName).toBe("SISPYME, S.L.");
      expect(CONTRACT_PROVIDER.cif).toBe("B-33047580");
      expect(CONTRACT_PROVIDER.city).toBe("Pola de Siero");
      expect(CONTRACT_PROVIDER.province).toBe("Asturias");
      expect(CONTRACT_PROVIDER.jurisdiction).toBe("Oviedo");
      expect(CONTRACT_PROVIDER.productName).toBe("Prontara");
    });
  });

  describe("CONTRACT_PLAN_LABEL", () => {
    it("tiene labels para los 4 plans", () => {
      expect(CONTRACT_PLAN_LABEL.trial).toBe("Trial");
      expect(CONTRACT_PLAN_LABEL.basico).toBe("Básico");
      expect(CONTRACT_PLAN_LABEL.estandar).toBe("Estándar");
      expect(CONTRACT_PLAN_LABEL.premium).toBe("Premium");
    });
  });

  describe("CONTRACT_PLAN_FEATURES", () => {
    it("estandar incluye lo del basico explícitamente", () => {
      const estandar = CONTRACT_PLAN_FEATURES.estandar.join(" ");
      expect(estandar.toLowerCase()).toContain("básico");
    });
    it("premium incluye lo del estandar explícitamente", () => {
      const premium = CONTRACT_PLAN_FEATURES.premium.join(" ");
      expect(premium.toLowerCase()).toContain("estándar");
    });
  });

  describe("formatContractEuros", () => {
    it("formatea céntimos a euros con separadores españoles", () => {
      // Nota: el separador depende del locale del runtime de tests.
      // En node "es-ES" da formato 1.250,00 €. Verificamos que contiene 1250 o 1.250 + decimales.
      expect(formatContractEuros(125000)).toMatch(/1[.,]?250[,.]00\s?€/);
    });
    it("formatea 0 como 0,00 €", () => {
      expect(formatContractEuros(0)).toMatch(/0[,.]00\s?€/);
    });
    it("formatea 1 céntimo correctamente", () => {
      expect(formatContractEuros(1)).toMatch(/0[,.]01\s?€/);
    });
  });

  describe("formatContractDate", () => {
    it("formatea una fecha en español con día, mes (palabra), año", () => {
      const d = new Date("2026-04-28T12:00:00Z");
      const result = formatContractDate(d);
      expect(result).toMatch(/abril/i);
      expect(result).toContain("2026");
      expect(result).toMatch(/2[78]/); // 27 o 28 dependiendo de zona horaria
    });
  });
});
