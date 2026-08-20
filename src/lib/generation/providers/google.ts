import {
  capProviderInputImages,
  MAX_GOOGLE_INPUT_IMAGES,
} from "@/lib/images/constants";
import type { GeneratedImage } from "../types";
import { GenerationUpstreamError } from "../types";
import type {
  ImageAndTextToImageInput,
  ImageToTextInput,
  ModelProvider,
  TextToImageInput,
  TextToTextInput,
} from "./types";

type GeminiInlineData = {
  mimeType?: string;
  data?: string;
};

type GeminiPart = {
  inlineData?: GeminiInlineData;
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

async function fileToInlinePart(file: File): Promise<GeminiPart> {
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  return {
    inlineData: {
      mimeType: file.type || "image/png",
      data,
    },
  };
}

async function filesToInlineParts(files: File[]): Promise<GeminiPart[]> {
  return Promise.all(files.map(fileToInlinePart));
}

function textFromParts(parts: GeminiPart[]): string {
  return parts
    .map((part) => part.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join("\n")
    .trim();
}

export class GoogleModelProvider implements ModelProvider {
  constructor(private readonly apiKey: string) {}

  async textToImage(input: TextToImageInput): Promise<GeneratedImage[]> {
    const imageParts = await filesToInlineParts(
      capProviderInputImages(MAX_GOOGLE_INPUT_IMAGES, undefined, input.images),
    );
    return this.generateImages(
      input.prompt,
      input.count,
      input.modelId,
      imageParts,
    );
  }

  async imageAndTextToImage(
    input: ImageAndTextToImageInput,
  ): Promise<GeneratedImage[]> {
    const imageParts = await filesToInlineParts(
      capProviderInputImages(
        MAX_GOOGLE_INPUT_IMAGES,
        input.image,
        input.images,
      ),
    );
    return this.generateImages(
      input.prompt,
      input.count,
      input.modelId,
      imageParts,
    );
  }

  async imageToText(input: ImageToTextInput): Promise<string> {
    const sourcePart = await fileToInlinePart(input.image);
    return this.generateText(input.modelId, [
      sourcePart,
      { text: input.prompt },
    ]);
  }

  async textToText(input: TextToTextInput): Promise<string> {
    return this.generateText(input.modelId, [{ text: input.prompt }]);
  }

  private async generateImages(
    prompt: string,
    count: number,
    modelId: string,
    imageParts: GeminiPart[] = [],
  ): Promise<GeneratedImage[]> {
    const results = await Promise.allSettled(
      Array.from({ length: count }, () =>
        this.generateOneImage(prompt, modelId, imageParts),
      ),
    );

    const images: GeneratedImage[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        images.push(result.value);
      }
    }

    if (images.length === 0) {
      throw new GenerationUpstreamError(firstRejectionMessage(results));
    }

    return images;
  }

  private async generateOneImage(
    prompt: string,
    modelId: string,
    imageParts: GeminiPart[] = [],
  ): Promise<GeneratedImage> {
    const parts: GeminiPart[] = [...imageParts, { text: prompt }];

    const payload = await this.generateContent(modelId, parts, {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K",
      },
    });

    const responseParts = payload.candidates?.[0]?.content?.parts ?? [];
    const inline = responseParts.find((part) => part.inlineData?.data)?.inlineData;

    if (!inline?.data) {
      throw new GenerationUpstreamError("Gemini response missing image data.");
    }

    return {
      bytes: base64ToBytes(inline.data),
      mimeType: inline.mimeType || "image/png",
    };
  }

  private async generateText(
    modelId: string,
    parts: GeminiPart[],
  ): Promise<string> {
    const payload = await this.generateContent(modelId, parts);
    const responseParts = payload.candidates?.[0]?.content?.parts ?? [];
    const text = textFromParts(responseParts);

    if (!text) {
      throw new GenerationUpstreamError("Gemini response missing text.");
    }

    return text;
  }

  private async generateContent(
    modelId: string,
    parts: GeminiPart[],
    generationConfig?: Record<string, unknown>,
  ): Promise<GeminiResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        ...(generationConfig ? { generationConfig } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new GenerationUpstreamError(
        `Gemini request failed (${response.status}): ${detail || response.statusText}`,
      );
    }

    return (await response.json()) as GeminiResponse;
  }
}

function firstRejectionMessage(
  results: PromiseSettledResult<unknown>[],
): string {
  const firstRejection = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  return firstRejection?.reason instanceof Error
    ? firstRejection.reason.message
    : "Gemini returned no images.";
}
