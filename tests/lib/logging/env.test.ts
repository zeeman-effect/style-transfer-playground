import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalFilesystemLogging } from "@/lib/logging/env";

describe("isLocalFilesystemLogging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true for the default file database and false for remote urls", () => {
    delete process.env.DATABASE_URL;
    expect(isLocalFilesystemLogging()).toBe(true);
    vi.stubEnv("DATABASE_URL", "file:./data/app.db");
    expect(isLocalFilesystemLogging()).toBe(true);
    vi.stubEnv("DATABASE_URL", "libsql://example.turso.io");
    expect(isLocalFilesystemLogging()).toBe(false);
  });
});
