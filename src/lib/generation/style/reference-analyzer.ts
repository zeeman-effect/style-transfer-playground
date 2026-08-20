import type { StyleAnalysis, StyleAnalyzer } from "./analyzer";

const REFERENCE_STYLE_HINT =
  "Match the attached reference images for grain, texture, color grade, caption typography and placement, composition, and framing. Do not copy joke text, watermarks, handles, subjects, or punchlines from the references.";

export class ReferenceStyleAnalyzer implements StyleAnalyzer {
  async analyze(examples: File[]): Promise<StyleAnalysis> {
    if (examples.length === 0) {
      return { styleHint: "" };
    }

    return {
      styleHint: REFERENCE_STYLE_HINT,
      referenceImages: examples,
    };
  }
}
