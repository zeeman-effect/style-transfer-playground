import { describe, expect, it, vi } from "vitest";
import {
  redactForLog,
  redactString,
  safeErrorMessage,
  toRedactedJson,
  warnLoggingFailure,
} from "@/lib/logging/redact";

describe("redactString", () => {
  it("strips bearer, goog, and authorization secrets", () => {
    expect(redactString("Authorization: Bearer supersecret")).toContain(
      "[REDACTED]",
    );
    expect(redactString("x-goog-api-key: abc123")).toBe(
      "x-goog-api-key: [REDACTED]",
    );
    expect(redactString("plain text")).toBe("plain text");
  });
});

describe("redactForLog", () => {
  it("redacts secret field names and provider key strings", () => {
    expect(
      redactForLog({
        password: "pw",
        apiKey: "k",
        google: "gk",
        openai: "ok",
        nested: { authorization: "tok" },
        keep: "visible",
        list: [{ secret: "s" }],
      }),
    ).toEqual({
      password: "[REDACTED]",
      apiKey: "[REDACTED]",
      google: "[REDACTED]",
      openai: "[REDACTED]",
      nested: { authorization: "[REDACTED]" },
      keep: "visible",
      list: [{ secret: "[REDACTED]" }],
    });
    expect(redactForLog(4)).toBe(4);
    expect(redactForLog(null)).toBeNull();
  });
});

describe("safeErrorMessage", () => {
  it("redacts known errors and falls back to Unknown error", () => {
    expect(safeErrorMessage(new Error("Bearer abc"))).toContain("[REDACTED]");
    expect(safeErrorMessage("plain")).toBe("plain");
    expect(safeErrorMessage({})).toBe("Unknown error");
  });
});

describe("toRedactedJson and warnLoggingFailure", () => {
  it("pretty-prints redacted JSON and warns with a safe message", () => {
    expect(toRedactedJson({ key: "secret" })).toBe('{"key":"[REDACTED]"}');
    expect(toRedactedJson({ keep: 1 }, true)).toContain("\n");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnLoggingFailure("write", new Error("nope"));
    expect(warn).toHaveBeenCalledWith("Logging failed (write): nope");
    warn.mockRestore();
  });
});
