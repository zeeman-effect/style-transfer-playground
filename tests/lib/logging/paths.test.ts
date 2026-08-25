import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extensionForMimeType,
  logsRootDir,
  runDir,
  runFilePath,
  sanitizePathSegment,
  toLogPath,
  userLogsDir,
} from "@/lib/logging/paths";

describe("sanitizePathSegment", () => {
  it("strips unsafe characters, leading dots, and empty results", () => {
    expect(sanitizePathSegment("../etc/passwd")).toBe("_etc_passwd");
    expect(sanitizePathSegment("...hidden")).toBe("hidden");
    expect(sanitizePathSegment("...")).toBe("unknown");
    expect(sanitizePathSegment("")).toBe("unknown");
    expect(sanitizePathSegment("a".repeat(200)).length).toBe(128);
  });
});

describe("log path helpers", () => {
  it("nests user and run dirs under data/logs", () => {
    expect(logsRootDir()).toBe(path.join(process.cwd(), "data", "logs"));
    expect(userLogsDir("user/1")).toBe(
      path.join(logsRootDir(), "user_1"),
    );
    expect(runDir("u", "r")).toBe(path.join(userLogsDir("u"), "r"));
    expect(runFilePath("u", "r", "calls.jsonl")).toBe(
      path.join(runDir("u", "r"), "calls.jsonl"),
    );
    expect(toLogPath("a", "b")).toBe("a/b");
  });
});

describe("extensionForMimeType", () => {
  it("maps common image types and defaults to png", () => {
    expect(extensionForMimeType("image/jpeg")).toBe("jpg");
    expect(extensionForMimeType("image/jpg")).toBe("jpg");
    expect(extensionForMimeType("image/webp")).toBe("webp");
    expect(extensionForMimeType("image/gif")).toBe("gif");
    expect(extensionForMimeType("image/png")).toBe("png");
    expect(extensionForMimeType("application/octet-stream")).toBe("png");
  });
});
