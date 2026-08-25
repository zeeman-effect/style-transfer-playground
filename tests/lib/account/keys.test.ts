import { describe, expect, it } from "vitest";
import { isProviderId } from "@/lib/account/keys";

describe("isProviderId", () => {
  it("accepts only google and openai", () => {
    expect(isProviderId("google")).toBe(true);
    expect(isProviderId("openai")).toBe(true);
    expect(isProviderId("anthropic")).toBe(false);
    expect(isProviderId("")).toBe(false);
    expect(isProviderId(null)).toBe(false);
    expect(isProviderId(1)).toBe(false);
  });
});
