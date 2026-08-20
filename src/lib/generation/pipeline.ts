import { createModelProvider } from "./providers";
import type { WrapModelProvider } from "./providers/types";
import { createStyleAnalyzer } from "./style/registry";
import type { StyleAnalyzer } from "./style/analyzer";
import {
  type GenerateMemeImagesInput,
  type GenerateMemeImagesResult,
  type GeneratedImage,
  GenerationClientError,
  GenerationUpstreamError,
  MAX_GENERATE_IMAGE_COUNT,
  MIN_GENERATE_IMAGE_COUNT,
} from "./types";
import type { GenerationRunLogger } from "@/lib/logging";

const OVERLAY_EXCLUSION_SECTION = `Do not copy watermarks or attribution:
Never reproduce watermarks, usernames, @handles, logos, timestamps, like/comment bars, or other platform UI from any example or reference image. Do not invent similar marks. Leave the image free of branding and account names unless the prompt explicitly asks for them.`;

function buildPrompt(prompt: string, styleHint: string): string {
  const sections = [prompt.trim()];
  const trimmedHint = styleHint.trim();
  if (trimmedHint) {
    sections.push(`Style guidance: ${trimmedHint}`);
  }
  sections.push(OVERLAY_EXCLUSION_SECTION);
  return sections.join("\n\n");
}

function toDataUrl(image: GeneratedImage): string {
  const base64 = Buffer.from(image.bytes).toString("base64");
  return `data:${image.mimeType};base64,${base64}`;
}

function assertGenerateImageCount(count: number): void {
  if (
    !Number.isInteger(count) ||
    count < MIN_GENERATE_IMAGE_COUNT ||
    count > MAX_GENERATE_IMAGE_COUNT
  ) {
    throw new GenerationClientError(
      `Count must be an integer from ${MIN_GENERATE_IMAGE_COUNT} to ${MAX_GENERATE_IMAGE_COUNT}.`,
    );
  }
}

export type GenerateMemeImagesDeps = {
  styleAnalyzer?: StyleAnalyzer;
  wrapProvider?: WrapModelProvider;
  runLogger?: GenerationRunLogger;
};

export async function generateMemeImages(
  input: GenerateMemeImagesInput,
  deps: GenerateMemeImagesDeps = {},
): Promise<GenerateMemeImagesResult> {
  assertGenerateImageCount(input.count);

  const wrapProvider: WrapModelProvider =
    deps.wrapProvider ?? ((provider) => provider);
  const styleAnalyzer =
    deps.styleAnalyzer ??
    createStyleAnalyzer(
      input.analyzerId,
      input.analysisModelId,
      input.keys,
      wrapProvider,
      deps.runLogger,
    );
  const provider = wrapProvider(createModelProvider(input.modelId, input.keys));
  const runLogger = deps.runLogger;

  if (runLogger) {
    await Promise.all(
      input.examples.map((example, index) =>
        runLogger.saveExampleImage(index, example),
      ),
    );
    if (input.sourceImage) {
      await runLogger.saveSourceImage(input.sourceImage);
    }
  }

  const analysis = await styleAnalyzer.analyze(input.examples);
  const styleHint = analysis.styleHint;
  runLogger?.setStyleHint(styleHint);
  const combinedPrompt = buildPrompt(input.prompt, styleHint);
  const referenceImages =
    analysis.referenceImages && analysis.referenceImages.length > 0
      ? analysis.referenceImages
      : undefined;

  const generated = input.sourceImage
    ? await provider.imageAndTextToImage({
        prompt: combinedPrompt,
        image: input.sourceImage,
        images: referenceImages,
        count: input.count,
        modelId: input.modelId,
      })
    : await provider.textToImage({
        prompt: combinedPrompt,
        images: referenceImages,
        count: input.count,
        modelId: input.modelId,
      });

  if (generated.length === 0) {
    throw new GenerationUpstreamError("No images were generated.");
  }

  if (runLogger) {
    await Promise.all(
      generated.map((image, index) =>
        runLogger.saveCandidateImage(index, image),
      ),
    );
  }

  return {
    images: generated.map(toDataUrl),
    styleHint,
  };
}
