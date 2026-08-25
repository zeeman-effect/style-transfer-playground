import { describe, expect, it } from "vitest";
import {
  getConfiguredProviders,
  hasProviderKey,
  providerNotConfiguredMessage,
} from "@/lib/generation/config";

describe("hasProviderKey", () => {
  it("is true only for a non-empty trimmed key", () => {
    expect(hasProviderKey({ google: "abc" }, "google")).toBe(true);
    expect(hasProviderKey({ google: "  " }, "google")).toBe(false);
    expect(hasProviderKey({ google: "" }, "google")).toBe(false);
    expect(hasProviderKey({}, "openai")).toBe(false);
  });
});

describe("getConfiguredProviders", () => {
  it("reports each provider independently", () => {
    expect(getConfiguredProviders({ google: "g", openai: "o" })).toEqual({
      google: true,
      openai: true,
    });
    expect(getConfiguredProviders({ google: "g" })).toEqual({
      google: true,
      openai: false,
    });
    expect(getConfiguredProviders({})).toEqual({
      google: false,
      openai: false,
    });
  });
});

describe("providerNotConfiguredMessage", () => {
  it("names the provider and points at Settings", () => {
    expect(providerNotConfiguredMessage("google")).toBe(
      "Google is not configured. Add a Google API key in Settings to generate with this model.",
    );
    expect(providerNotConfiguredMessage("openai")).toBe(
      "OpenAI is not configured. Add a OpenAI API key in Settings to generate with this model.",
    );
  });
});
