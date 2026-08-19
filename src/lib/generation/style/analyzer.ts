import type { ModelProvider } from "../providers/types";

export const MAX_STYLE_EXAMPLES = 6;

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

export interface StyleAnalyzer {
  analyze(examples: File[]): Promise<string>;
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

  async analyze(examples: File[]): Promise<string> {
    const subset = examples.slice(0, MAX_STYLE_EXAMPLES);
    const descriptions = await Promise.all(
      subset.map((example) => this.visionToText(example)),
    );

    return this.generateStyleDescription(descriptions);
  }
}
