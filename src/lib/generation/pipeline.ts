import { createModelProvider } from "./providers";
import type { WrapModelProvider } from "./providers/types";
import { RandomImageRanker } from "./rank/random-ranker";
import { createStyleAnalyzer } from "./style/registry";
import type { StyleAnalyzer } from "./style/analyzer";
import type { ImageRanker } from "./rank/ranker";
import type {
  GenerateMemeImagesInput,
  GenerateMemeImagesResult,
  GeneratedImage,
} from "./types";
import { GenerationUpstreamError } from "./types";
import type { GenerationRunLogger } from "@/lib/logging";

export const CANDIDATE_COUNT = 1;
export const RESULT_COUNT = 1;

function buildPrompt(prompt: string, styleHint: string): string {
  const trimmedHint = styleHint.trim();
  if (!trimmedHint) {
    return prompt;
  }
  return `${prompt}\n\nStyle guidance: ${trimmedHint}`;
}

function toDataUrl(image: GeneratedImage): string {
  const base64 = Buffer.from(image.bytes).toString("base64");
  return `data:${image.mimeType};base64,${base64}`;
}

export type GenerateMemeImagesDeps = {
  styleAnalyzer?: StyleAnalyzer;
  ranker?: ImageRanker;
  wrapProvider?: WrapModelProvider;
  runLogger?: GenerationRunLogger;
};

export async function generateMemeImages(
  input: GenerateMemeImagesInput,
  deps: GenerateMemeImagesDeps = {},
): Promise<GenerateMemeImagesResult> {
  const wrapProvider: WrapModelProvider =
    deps.wrapProvider ?? ((provider) => provider);
  const styleAnalyzer =
    deps.styleAnalyzer ??
    createStyleAnalyzer(
      input.analyzerId,
      input.analysisModelId,
      input.keys,
      wrapProvider,
    );
  const ranker = deps.ranker ?? new RandomImageRanker();
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

  const styleHint = await styleAnalyzer.analyze(input.examples);
  runLogger?.setStyleHint(styleHint);
  const combinedPrompt = buildPrompt(input.prompt, styleHint);

  const candidates = input.sourceImage
    ? await provider.imageAndTextToImage({
        prompt: combinedPrompt,
        image: input.sourceImage,
        count: CANDIDATE_COUNT,
        modelId: input.modelId,
      })
    : await provider.textToImage({
        prompt: combinedPrompt,
        count: CANDIDATE_COUNT,
        modelId: input.modelId,
      });

  if (candidates.length < RESULT_COUNT) {
    throw new GenerationUpstreamError(
      `Only ${candidates.length} image(s) were generated; need at least ${RESULT_COUNT}.`,
    );
  }

  if (runLogger) {
    await Promise.all(
      candidates.map((candidate, index) =>
        runLogger.saveCandidateImage(index, candidate),
      ),
    );
  }

  const ranked = await ranker.rank(candidates, RESULT_COUNT);

  if (runLogger) {
    await Promise.all(
      ranked.map((image, index) => runLogger.saveRankedImage(index, image)),
    );
  }

  return {
    images: ranked.map(toDataUrl),
    styleHint,
  };
}
