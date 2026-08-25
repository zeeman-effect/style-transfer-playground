import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSiteAccessToken,
  isValidSiteAccessToken,
  isValidSitePassword,
  sanitizeReturnPath,
} from "@/lib/site-access";

describe("sanitizeReturnPath", () => {
  it("rejects open redirects and unlock loops", () => {
    expect(sanitizeReturnPath(undefined)).toBe("/");
    expect(sanitizeReturnPath("")).toBe("/");
    expect(sanitizeReturnPath("https://evil.com")).toBe("/");
    expect(sanitizeReturnPath("//evil.com")).toBe("/");
    expect(sanitizeReturnPath("/\\evil")).toBe("/");
    expect(sanitizeReturnPath("/ok/../secret")).toBe("/");
    expect(sanitizeReturnPath("/unlock")).toBe("/");
    expect(sanitizeReturnPath("/unlock?from=/x")).toBe("/");
    expect(sanitizeReturnPath("x".repeat(2049))).toBe("/");
  });

  it("keeps same-origin paths", () => {
    expect(sanitizeReturnPath("/settings")).toBe("/settings");
    expect(sanitizeReturnPath("/projects/abc?x=1")).toBe("/projects/abc?x=1");
  });
});

describe("password and token compare", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_PASSWORD", "correct-horse");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only the configured password", () => {
    expect(isValidSitePassword("correct-horse")).toBe(true);
    expect(isValidSitePassword("wrong")).toBe(false);
    expect(isValidSitePassword("")).toBe(false);
  });

  it("accepts only a token minted for the current password", () => {
    const token = createSiteAccessToken();
    expect(isValidSiteAccessToken(token)).toBe(true);
    expect(isValidSiteAccessToken("deadbeef")).toBe(false);
    expect(isValidSiteAccessToken(undefined)).toBe(false);
  });

  it("rejects tokens after the password is cleared", () => {
    const token = createSiteAccessToken();
    vi.stubEnv("SITE_PASSWORD", "");
    delete process.env.SITE_PASSWORD;
    expect(isValidSiteAccessToken(token)).toBe(false);
    expect(isValidSitePassword("correct-horse")).toBe(false);
  });
});
