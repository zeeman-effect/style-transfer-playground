import type { GenerationRunLogger } from "@/lib/logging";
import type { ModelProvider } from "../providers/types";
import type { StyleAnalysis, StyleAnalyzer } from "./analyzer";
import { buildCompositeImage } from "./composite-image";

const COMPOSITE_VISION_PROMPT = `This image is a style reference sheet: a no-gap grid of example memes. Analyze the shared visual style across the cells. Do not treat the collage, grid, or sheet layout itself as part of the style. Ignore empty or unused cells (black).

You are writing a reusable visual style profile for generating a NEW meme that matches these examples aesthetically.

Write a concise style profile covering:
- grain / texture / color treatment
- caption craft (font, case, outline, placement) — describe how text looks, never quote joke wording
- composition and framing
- exclusions (watermarks, handles, copied punchlines, or other details that would leak a specific joke)

Do not retell or copy any joke, caption wording, or specific subject from the examples.
Return only the style profile as a short paragraph the image model can follow.`;

export class CompositeAnalyzer implements StyleAnalyzer {
  constructor(
    private readonly provider: ModelProvider,
    private readonly textModelId: string,
    private readonly runLogger?: GenerationRunLogger,
  ) {}

  async analyze(examples: File[]): Promise<StyleAnalysis> {
    const composite = await buildCompositeImage(examples);
    if (!composite) {
      return { styleHint: "" };
    }

    await this.runLogger?.saveCompositeImage(composite);

    const styleHint = await this.provider.imageToText({
      image: composite,
      prompt: COMPOSITE_VISION_PROMPT,
      modelId: this.textModelId,
    });

    return { styleHint };
  }
}
