import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/encryption";

describe("encryptSecret / decryptSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("roundtrips with a 64-character hex key", () => {
    vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
    const { ciphertext, iv } = encryptSecret("hello-hex");
    expect(decryptSecret(ciphertext, iv)).toBe("hello-hex");
  });

  it("roundtrips with a 32-byte utf8 key", () => {
    vi.stubEnv("ENCRYPTION_KEY", "u".repeat(32));
    const { ciphertext, iv } = encryptSecret("hello-utf8");
    expect(decryptSecret(ciphertext, iv)).toBe("hello-utf8");
  });

  it("roundtrips with a 32-byte base64 key", () => {
    vi.stubEnv("ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const { ciphertext, iv } = encryptSecret("hello-b64");
    expect(decryptSecret(ciphertext, iv)).toBe("hello-b64");
  });

  it("rejects an invalid payload", () => {
    vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
    const { iv } = encryptSecret("ok");
    expect(() => decryptSecret("aaaa", iv)).toThrow("Encrypted value is invalid.");
    expect(() => decryptSecret(encryptSecret("ok").ciphertext, "****")).toThrow();
  });

  it("requires ENCRYPTION_KEY and rejects the wrong length", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY is not set/);
    vi.stubEnv("ENCRYPTION_KEY", "too-short");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });
});
