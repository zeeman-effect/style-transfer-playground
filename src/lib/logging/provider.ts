import { getAnalysisModelById } from "@/lib/generation/analysis-models";
import { getModelById } from "@/lib/generation/models";
import type { GeneratedImage, ProviderId } from "@/lib/generation/types";
import type {
  ImageAndTextToImageInput,
  ImageToTextInput,
  ModelProvider,
  TextToImageInput,
  TextToTextInput,
} from "@/lib/generation/providers/types";
import { safeErrorMessage } from "./redact";
import type { GenerationRunLogger } from "./run";
import type { ModelCallKind } from "./types";

function providerForModel(modelId: string): ProviderId | undefined {
  return (
    getModelById(modelId)?.provider ?? getAnalysisModelById(modelId)?.provider
  );
}

export class LoggingModelProvider implements ModelProvider {
  constructor(
    private readonly inner: ModelProvider,
    private readonly run: GenerationRunLogger,
  ) {}

  textToImage(input: TextToImageInput): Promise<GeneratedImage[]> {
    return this.trace({
      kind: "textToImage",
      prompt: input.prompt,
      modelId: input.modelId,
      execute: () => this.inner.textToImage(input),
      outputImages: (images) => images,
    });
  }

  imageAndTextToImage(
    input: ImageAndTextToImageInput,
  ): Promise<GeneratedImage[]> {
    return this.trace({
      kind: "imageAndTextToImage",
      prompt: input.prompt,
      modelId: input.modelId,
      image: input.image,
      execute: () => this.inner.imageAndTextToImage(input),
      outputImages: (images) => images,
    });
  }

  imageToText(input: ImageToTextInput): Promise<string> {
    return this.trace({
      kind: "imageToText",
      prompt: input.prompt,
      modelId: input.modelId,
      image: input.image,
      execute: () => this.inner.imageToText(input),
      outputText: (text) => text,
    });
  }

  textToText(input: TextToTextInput): Promise<string> {
    return this.trace({
      kind: "textToText",
      prompt: input.prompt,
      modelId: input.modelId,
      execute: () => this.inner.textToText(input),
      outputText: (text) => text,
    });
  }

  private async trace<T>(options: {
    kind: ModelCallKind;
    prompt: string;
    modelId: string;
    image?: File;
    execute: () => Promise<T>;
    outputText?: (result: T) => string;
    outputImages?: (result: T) => GeneratedImage[];
  }): Promise<T> {
    const seq = this.run.nextCallSeq();
    const startedAt = Date.now();
    const inputImagePaths: string[] = [];

    if (options.image) {
      const inputPath = await this.run.saveCallInputImage(seq, options.image);
      if (inputPath) {
        inputImagePaths.push(inputPath);
      }
    }

    try {
      const result = await options.execute();
      const outputImages = options.outputImages?.(result) ?? [];
      const outputImagePaths =
        outputImages.length > 0
          ? await this.run.saveCallOutputImages(seq, outputImages)
          : [];

      await this.run.recordCall({
        seq,
        kind: options.kind,
        provider: providerForModel(options.modelId),
        modelId: options.modelId,
        prompt: options.prompt,
        inputImagePaths,
        outputText: options.outputText?.(result),
        outputImagePaths,
        latencyMs: Date.now() - startedAt,
      });

      return result;
    } catch (error) {
      await this.run.recordCall({
        seq,
        kind: options.kind,
        provider: providerForModel(options.modelId),
        modelId: options.modelId,
        prompt: options.prompt,
        inputImagePaths,
        outputImagePaths: [],
        latencyMs: Date.now() - startedAt,
        error: safeErrorMessage(error),
      });
      throw error;
    }
  }
}
