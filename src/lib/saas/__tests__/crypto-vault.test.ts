import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.PRONTARA_SESSION_SECRET = "test-secret-very-long-and-random-1234567890abcdef";
});

describe("crypto-vault (H1-SEC-01)", () => {
  it("round-trips a TOTP-like Base32 secret", async () => {
    const { encryptString, decryptString } = await import("@/lib/saas/crypto-vault");
    const plain = "JBSWY3DPEHPK3PXPMNQGY2DJNZRWC23FOJSXG43BO5SXEYTBONRWS43BMU";
    const enc = encryptString(plain);
    expect(enc).not.toBe(plain);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptString(enc)).toBe(plain);
  });

  it("returns empty string for empty input", async () => {
    const { encryptString, decryptString } = await import("@/lib/saas/crypto-vault");
    expect(encryptString("")).toBe("");
    expect(decryptString("")).toBe("");
  });

  it("treats legacy plaintext (no v1: prefix) as already-decoded", async () => {
    const { decryptString } = await import("@/lib/saas/crypto-vault");
    const legacy = "PLAIN-LEGACY-VALUE";
    expect(decryptString(legacy)).toBe(legacy);
  });

  it("ensureEncrypted is idempotent", async () => {
    const { ensureEncrypted, decryptString } = await import("@/lib/saas/crypto-vault");
    const plain = "hello";
    const once = ensureEncrypted(plain);
    const twice = ensureEncrypted(once);
    expect(once).toBe(twice);
    expect(decryptString(twice)).toBe(plain);
  });

  it("throws on tampered blob (auth tag mismatch)", async () => {
    const { encryptString, decryptString } = await import("@/lib/saas/crypto-vault");
    const enc = encryptString("important-data");
    const parts = enc.split(":");
    // tampering: flip one bit in ciphertext
    const tampered = parts[0] + ":" + parts[1] + ":" + "AAAA" + parts[2].slice(4) + ":" + parts[3];
    expect(() => decryptString(tampered)).toThrow();
  });

  it("two encrypts of the same plaintext yield different blobs (random IV)", async () => {
    const { encryptString } = await import("@/lib/saas/crypto-vault");
    const a = encryptString("repeat");
    const b = encryptString("repeat");
    expect(a).not.toBe(b);
  });

  it("handles long XML payloads (Verifactu-sized)", async () => {
    const { encryptString, decryptString } = await import("@/lib/saas/crypto-vault");
    const xml = "<root>" + "x".repeat(50_000) + "</root>";
    const enc = encryptString(xml);
    expect(decryptString(enc)).toBe(xml);
  });
});
