import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  signFirstAccessToken,
  verifyFirstAccessToken,
} from "@/lib/saas/first-access-token";

describe("first-access-token sign/verify", () => {
  const ORIGINAL = process.env.PRONTARA_ACTIVATION_SECRET;

  beforeEach(() => {
    process.env.PRONTARA_ACTIVATION_SECRET =
      "test-activation-secret-with-enough-bytes-32+";
  });

  afterEach(() => {
    if (ORIGINAL !== undefined) process.env.PRONTARA_ACTIVATION_SECRET = ORIGINAL;
    else delete process.env.PRONTARA_ACTIVATION_SECRET;
  });

  const baseInput = {
    accountId: "acc-123",
    clientId: "client-456",
    email: "user@example.com",
  };

  it("genera un token firmado válido", () => {
    const token = signFirstAccessToken(baseInput);
    expect(token).toContain(".");
    const parts = token.split(".");
    expect(parts.length).toBe(2);
  });

  it("verifica un token recién emitido y devuelve el payload original", () => {
    const token = signFirstAccessToken(baseInput);
    const payload = verifyFirstAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.accountId).toBe(baseInput.accountId);
    expect(payload?.clientId).toBe(baseInput.clientId);
    expect(payload?.email).toBe(baseInput.email);
    expect(payload?.exp).toBeGreaterThan(Date.now());
  });

  it("el token expira a las 48h aprox", () => {
    const token = signFirstAccessToken(baseInput);
    const payload = verifyFirstAccessToken(token);
    const now = Date.now();
    const expectedExp = now + 1000 * 60 * 60 * 48;
    // Margen de 5 segundos por la latencia entre sign y verify
    expect(payload!.exp).toBeGreaterThan(expectedExp - 5_000);
    expect(payload!.exp).toBeLessThan(expectedExp + 5_000);
  });

  it("rechaza tokens vacíos o malformados", () => {
    expect(verifyFirstAccessToken("")).toBeNull();
    expect(verifyFirstAccessToken("sin-punto")).toBeNull();
    expect(verifyFirstAccessToken(".sin-encoded")).toBeNull();
    expect(verifyFirstAccessToken("encoded.")).toBeNull();
  });

  it("rechaza un token firmado con secreto distinto", () => {
    const token = signFirstAccessToken(baseInput);
    process.env.PRONTARA_ACTIVATION_SECRET =
      "otro-secreto-distinto-con-mas-de-32-chars-yz";
    expect(verifyFirstAccessToken(token)).toBeNull();
  });

  it("rechaza tokens con firma manipulada", () => {
    const token = signFirstAccessToken(baseInput);
    const [encoded, sig] = token.split(".");
    const tamperedSig = sig.slice(0, -2) + "ZZ";
    expect(verifyFirstAccessToken(encoded + "." + tamperedSig)).toBeNull();
  });
});
