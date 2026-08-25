import { describe, expect, it } from "vitest";
import { getAnalyzerById, STYLE_ANALYZERS } from "@/lib/generation/style/catalog";

describe("STYLE_ANALYZERS", () => {
  it("includes the five catalog analyzers", () => {
    expect(STYLE_ANALYZERS.map((entry) => entry.id)).toEqual([
      "noop",
      "deep",
      "composite",
      "reference",
      "composite-reference",
    ]);
  });

  it("marks analysis-model requirements", () => {
    expect(getAnalyzerById("noop")?.requiresAnalysisModel).toBe(false);
    expect(getAnalyzerById("reference")?.requiresAnalysisModel).toBe(false);
    expect(getAnalyzerById("composite-reference")?.requiresAnalysisModel).toBe(
      false,
    );
    expect(getAnalyzerById("deep")?.requiresAnalysisModel).toBe(true);
    expect(getAnalyzerById("composite")?.requiresAnalysisModel).toBe(true);
  });

  it("returns undefined for unknown ids", () => {
    expect(getAnalyzerById("missing")).toBeUndefined();
  });
});
