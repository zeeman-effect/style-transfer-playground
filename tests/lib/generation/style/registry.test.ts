import { describe, expect, it, vi } from "vitest";
import { DeepStyleAnalyzer } from "@/lib/generation/style/analyzer";
import { CompositeAnalyzer } from "@/lib/generation/style/composite-analyzer";
import { CompositeReferenceAnalyzer } from "@/lib/generation/style/composite-reference-analyzer";
import { NoopStyleAnalyzer } from "@/lib/generation/style/noop-analyzer";
import { ReferenceStyleAnalyzer } from "@/lib/generation/style/reference-analyzer";
import { createStyleAnalyzer } from "@/lib/generation/style/registry";
import { GenerationClientError } from "@/lib/generation/types";
import { mockModelProvider } from "../../../helpers";

vi.mock("@/lib/generation/providers", () => ({
  createModelProvider: vi.fn(() => ({
    textToImage: vi.fn(),
    imageAndTextToImage: vi.fn(),
    imageToText: vi.fn(),
    textToText: vi.fn(),
  })),
}));

describe("createStyleAnalyzer", () => {
  it("throws for an unknown analyzer", () => {
    expect(() => createStyleAnalyzer("nope", undefined, {})).toThrow(
      GenerationClientError,
    );
    expect(() => createStyleAnalyzer("nope", undefined, {})).toThrow(
      "Unknown analyzer: nope",
    );
  });

  it("builds analyzers that do not need an analysis model", () => {
    expect(createStyleAnalyzer("noop", undefined, {})).toBeInstanceOf(
      NoopStyleAnalyzer,
    );
    expect(createStyleAnalyzer("reference", undefined, {})).toBeInstanceOf(
      ReferenceStyleAnalyzer,
    );
    expect(
      createStyleAnalyzer("composite-reference", undefined, {}),
    ).toBeInstanceOf(CompositeReferenceAnalyzer);
  });

  it("requires a known analysis model for deep and composite", () => {
    expect(() => createStyleAnalyzer("deep", undefined, {})).toThrow(
      "Analysis model is required for this analyzer.",
    );
    expect(() => createStyleAnalyzer("deep", "not-real", {})).toThrow(
      "Unknown analysis model: not-real",
    );
    expect(() => createStyleAnalyzer("composite", undefined, {})).toThrow(
      "Analysis model is required for this analyzer.",
    );
  });

  it("builds deep and composite analyzers when the analysis model is known", () => {
    expect(
      createStyleAnalyzer("deep", "gemini-3.6-flash", { google: "k" }),
    ).toBeInstanceOf(DeepStyleAnalyzer);
    expect(
      createStyleAnalyzer("composite", "gpt-4.1", { openai: "k" }),
    ).toBeInstanceOf(CompositeAnalyzer);
  });

  it("wraps the analysis provider when wrapProvider is passed", async () => {
    const wrapped = mockModelProvider({
      imageToText: vi.fn().mockResolvedValue(""),
      textToText: vi.fn().mockResolvedValue(""),
    });
    const wrapProvider = vi.fn(() => wrapped);
    const analyzer = createStyleAnalyzer(
      "deep",
      "gemini-3.6-flash",
      { google: "k" },
      wrapProvider,
    );
    expect(wrapProvider).toHaveBeenCalledOnce();
    await analyzer.analyze([]);
    expect(wrapped.imageToText).not.toHaveBeenCalled();
  });
});
