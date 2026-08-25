import { describe, expect, it } from "vitest";
import { providerNotConfiguredMessage } from "@/lib/generation/config";
import { createModelProvider } from "@/lib/generation/providers";
import { GoogleModelProvider } from "@/lib/generation/providers/google";
import { OpenAIModelProvider } from "@/lib/generation/providers/openai";
import { GenerationClientError } from "@/lib/generation/types";

describe("createModelProvider", () => {
  it("throws for an unknown model", () => {
    expect(() => createModelProvider("not-real", { google: "k" })).toThrow(
      GenerationClientError,
    );
    expect(() => createModelProvider("not-real", { google: "k" })).toThrow(
      "Unknown model: not-real",
    );
  });

  it("throws when the provider key is missing", () => {
    expect(() => createModelProvider("gpt-image-2", {})).toThrow(
      providerNotConfiguredMessage("openai"),
    );
    expect(() =>
      createModelProvider("gemini-3.1-flash-image", { google: "  " }),
    ).toThrow(providerNotConfiguredMessage("google"));
  });

  it("returns a Google provider for Google models", () => {
    expect(
      createModelProvider("gemini-3.1-flash-image", { google: "gk" }),
    ).toBeInstanceOf(GoogleModelProvider);
    expect(
      createModelProvider("gemini-3.6-flash", { google: "gk" }),
    ).toBeInstanceOf(GoogleModelProvider);
  });

  it("returns an OpenAI provider for OpenAI models", () => {
    expect(
      createModelProvider("gpt-image-2", { openai: "ok" }),
    ).toBeInstanceOf(OpenAIModelProvider);
    expect(
      createModelProvider("gpt-4.1", { openai: "ok" }),
    ).toBeInstanceOf(OpenAIModelProvider);
  });
});
