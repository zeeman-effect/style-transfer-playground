import type { GenerationRunLogger } from "@/lib/logging";
import type { StyleAnalysis, StyleAnalyzer } from "./analyzer";
import { buildCompositeImage } from "./composite-image";

const COMPOSITE_REFERENCE_STYLE_HINT =
  "The attached image is a style reference sheet: a grid of example memes. Match the shared look across the cells for grain, texture, color grade, caption typography and placement, composition, and framing. Do not treat the collage or grid layout itself as part of the style. Do not copy joke text, watermarks, handles, subjects, or punchlines from the references. Ignore empty or unused cells (black).";

export class CompositeReferenceAnalyzer implements StyleAnalyzer {
  constructor(private readonly runLogger?: GenerationRunLogger) {}

  async analyze(examples: File[]): Promise<StyleAnalysis> {
    const composite = await buildCompositeImage(examples);
    if (!composite) {
      return { styleHint: "" };
    }

    await this.runLogger?.saveCompositeImage(composite);

    return {
      styleHint: COMPOSITE_REFERENCE_STYLE_HINT,
      referenceImages: [composite],
    };
  }
}
