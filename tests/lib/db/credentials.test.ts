import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDatabaseAuthToken,
  getDatabaseUrl,
  isFileDatabaseUrl,
} from "@/lib/db/credentials";

describe("database credentials", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the local file database", () => {
    delete process.env.DATABASE_URL;
    expect(getDatabaseUrl()).toBe("file:./data/app.db");
    vi.stubEnv("DATABASE_URL", "libsql://db.turso.io");
    expect(getDatabaseUrl()).toBe("libsql://db.turso.io");
  });

  it("detects file: urls", () => {
    expect(isFileDatabaseUrl("file:./data/app.db")).toBe(true);
    expect(isFileDatabaseUrl("libsql://db.turso.io")).toBe(false);
  });

  it("skips a token for file databases and requires one remotely", () => {
    expect(getDatabaseAuthToken("file:./data/app.db")).toBeUndefined();
    delete process.env.TURSO_AUTH_TOKEN;
    expect(() => getDatabaseAuthToken("libsql://db.turso.io")).toThrow(
      /TURSO_AUTH_TOKEN/,
    );
    vi.stubEnv("TURSO_AUTH_TOKEN", " turso-token ");
    expect(getDatabaseAuthToken("libsql://db.turso.io")).toBe("turso-token");
  });
});
