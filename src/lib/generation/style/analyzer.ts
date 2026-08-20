import { VISION_ANALYSIS_BATCH } from "@/lib/images/constants";
import type { ModelProvider } from "../providers/types";

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(mapper))));
  }
  return results;
}

const VISION_PROMPT =
  "Describe the visual meme style of this image. Cover grain or compression, color grade, caption typography and placement, composition, and framing. Do not transcribe joke text or name specific people or punchlines.";

function buildStyleSynthesisPrompt(descriptions: string[]): string {
  const numbered = descriptions
    .map((description, index) => `${index + 1}. ${description}`)
    .join("\n");

  return `You are writing a reusable visual style profile for generating a NEW meme that matches these examples aesthetically.

Example observations:
${numbered}

Write a concise style profile covering:
- grain / texture / color treatment
- caption craft (font, case, outline, placement) — describe how text looks, never quote joke wording
- composition and framing
- exclusions (watermarks, handles, copied punchlines, or other details that would leak a specific joke)

Do not retell or copy any joke, caption wording, or specific subject from the examples.
Return only the style profile as a short paragraph the image model can follow.`;
}

export type StyleAnalysis = {
  styleHint: string;
  referenceImages?: File[];
};

export interface StyleAnalyzer {
  analyze(examples: File[]): Promise<StyleAnalysis>;
}

export class DeepStyleAnalyzer implements StyleAnalyzer {
  constructor(
    private readonly provider: ModelProvider,
    private readonly textModelId: string,
  ) {}

  private async visionToText(example: File): Promise<string> {
    return this.provider.imageToText({
      image: example,
      prompt: VISION_PROMPT,
      modelId: this.textModelId,
    });
  }

  private async generateStyleDescription(
    descriptions: string[],
  ): Promise<string> {
    const usable = descriptions
      .map((description) => description.trim())
      .filter((description) => description.length > 0);

    if (usable.length === 0) {
      return "";
    }

    return this.provider.textToText({
      prompt: buildStyleSynthesisPrompt(usable),
      modelId: this.textModelId,
    });
  }

  async analyze(examples: File[]): Promise<StyleAnalysis> {
    const descriptions = await mapInBatches(
      examples,
      VISION_ANALYSIS_BATCH,
      (example) => this.visionToText(example),
    );

    return { styleHint: await this.generateStyleDescription(descriptions) };
  }
}
