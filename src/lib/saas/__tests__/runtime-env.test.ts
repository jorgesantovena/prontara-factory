import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPublicBaseUrl } from "@/lib/saas/runtime-env";

const URL_VARS = [
  "PRONTARA_PUBLIC_BASE_URL",
  "PRONTARA_APP_BASE_URL",
  "PRONTARA_PUBLIC_URL",
  "APP_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
];

function clearAll() {
  for (const k of URL_VARS) delete process.env[k];
}

describe("runtime-env.getPublicBaseUrl", () => {
  let snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    snapshot = {};
    for (const k of URL_VARS) snapshot[k] = process.env[k];
    clearAll();
  });

  afterEach(() => {
    clearAll();
    for (const [k, v] of Object.entries(snapshot)) {
      if (v !== undefined) process.env[k] = v;
    }
  });

  it("devuelve localhost cuando no hay ninguna variable", () => {
    expect(getPublicBaseUrl()).toBe("http://localhost:3000");
  });

  it("usa la canónica PRONTARA_PUBLIC_BASE_URL si está", () => {
    process.env.PRONTARA_PUBLIC_BASE_URL = "https://app.prontara.com";
    expect(getPublicBaseUrl()).toBe("https://app.prontara.com");
  });

  it("quita el trailing slash", () => {
    process.env.PRONTARA_PUBLIC_BASE_URL = "https://app.prontara.com/";
    expect(getPublicBaseUrl()).toBe("https://app.prontara.com");
  });

  it("cae a fallback PRONTARA_APP_BASE_URL si la canónica no está", () => {
    process.env.PRONTARA_APP_BASE_URL = "https://legacy.prontara.com";
    expect(getPublicBaseUrl()).toBe("https://legacy.prontara.com");
  });

  it("respeta el orden de fallback (canónica gana sobre legacy)", () => {
    process.env.PRONTARA_PUBLIC_BASE_URL = "https://canonical.prontara.com";
    process.env.PRONTARA_APP_BASE_URL = "https://legacy.prontara.com";
    expect(getPublicBaseUrl()).toBe("https://canonical.prontara.com");
  });

  it("ignora valores vacíos o solo espacios", () => {
    process.env.PRONTARA_PUBLIC_BASE_URL = "   ";
    process.env.PRONTARA_APP_BASE_URL = "https://valid.prontara.com";
    expect(getPublicBaseUrl()).toBe("https://valid.prontara.com");
  });
});
