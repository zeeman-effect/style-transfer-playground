import { describe, expect, it } from "vitest";
import { GENERATION_MODELS, getModelById } from "@/lib/generation/models";

describe("GENERATION_MODELS", () => {
  it("lists google and openai image models with ids and labels", () => {
    expect(GENERATION_MODELS.length).toBeGreaterThan(0);
    for (const model of GENERATION_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
      expect(["google", "openai"]).toContain(model.provider);
    }
    expect(GENERATION_MODELS.some((model) => model.provider === "google")).toBe(
      true,
    );
    expect(GENERATION_MODELS.some((model) => model.provider === "openai")).toBe(
      true,
    );
  });
});

describe("getModelById", () => {
  it("finds a known model and returns undefined for unknown ids", () => {
    const known = GENERATION_MODELS[0];
    expect(getModelById(known.id)).toEqual(known);
    expect(getModelById("not-a-model")).toBeUndefined();
  });
});
