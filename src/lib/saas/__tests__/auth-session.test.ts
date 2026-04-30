import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken, readSessionToken } from "@/lib/saas/auth-session";
import type { TenantSessionUser } from "@/lib/saas/account-definition";

const TEST_USER: TenantSessionUser = {
  accountId: "acc-test-1",
  tenantId: "tenant-test-1",
  clientId: "client-test-1",
  slug: "test-tenant",
  email: "test@example.com",
  fullName: "Tester McTest",
  role: "admin",
  mustChangePassword: false,
};

describe("auth-session sign/verify HMAC", () => {
  const ORIGINAL_SECRET = process.env.PRONTARA_SESSION_SECRET;

  beforeEach(() => {
    process.env.PRONTARA_SESSION_SECRET = "this-is-a-test-secret-with-more-than-32-chars-x";
  });

  afterEach(() => {
    if (ORIGINAL_SECRET !== undefined) process.env.PRONTARA_SESSION_SECRET = ORIGINAL_SECRET;
    else delete process.env.PRONTARA_SESSION_SECRET;
  });

  it("genera un token con dos partes separadas por punto", () => {
    const token = createSessionToken(TEST_USER);
    expect(token).toContain(".");
    const parts = token.split(".");
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("verifica un token recién emitido y devuelve los datos del usuario", () => {
    const token = createSessionToken(TEST_USER);
    const session = readSessionToken(token);
    expect(session).not.toBeNull();
    expect(session?.accountId).toBe(TEST_USER.accountId);
    expect(session?.email).toBe(TEST_USER.email);
    expect(session?.role).toBe("admin");
  });

  it("rechaza un token con firma manipulada", () => {
    const token = createSessionToken(TEST_USER);
    // Cambiar el último char del payload (rompe la firma)
    const [encoded, sig] = token.split(".");
    const tampered = encoded.slice(0, -1) + (encoded.endsWith("A") ? "B" : "A") + "." + sig;
    expect(readSessionToken(tampered)).toBeNull();
  });

  it("rechaza un token con la firma cambiada", () => {
    const token = createSessionToken(TEST_USER);
    const [encoded] = token.split(".");
    const fakeSig = "deadbeefdeadbeef";
    expect(readSessionToken(encoded + "." + fakeSig)).toBeNull();
  });

  it("rechaza tokens malformados", () => {
    expect(readSessionToken("")).toBeNull();
    expect(readSessionToken(null)).toBeNull();
    expect(readSessionToken(undefined)).toBeNull();
    expect(readSessionToken("sin-punto-separador")).toBeNull();
    expect(readSessionToken(".sin-encoded")).toBeNull();
    expect(readSessionToken("encoded.")).toBeNull();
  });

  it("rechaza un token firmado con un secreto distinto", () => {
    const token = createSessionToken(TEST_USER);
    process.env.PRONTARA_SESSION_SECRET = "otro-secreto-de-mas-de-32-chars-aaaa-bbb";
    expect(readSessionToken(token)).toBeNull();
  });
});
