import { describe, expect, it } from "vitest";
import {
  ANALYSIS_MODELS,
  getAnalysisModelById,
} from "@/lib/generation/analysis-models";

describe("ANALYSIS_MODELS", () => {
  it("lists google and openai analysis models", () => {
    expect(ANALYSIS_MODELS.length).toBeGreaterThan(0);
    expect(ANALYSIS_MODELS.some((model) => model.provider === "google")).toBe(
      true,
    );
    expect(ANALYSIS_MODELS.some((model) => model.provider === "openai")).toBe(
      true,
    );
  });
});

describe("getAnalysisModelById", () => {
  it("finds a known model and returns undefined for unknown ids", () => {
    const known = ANALYSIS_MODELS[0];
    expect(getAnalysisModelById(known.id)).toEqual(known);
    expect(getAnalysisModelById("not-an-analysis-model")).toBeUndefined();
  });
});
