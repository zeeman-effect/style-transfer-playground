import {
  capProviderInputImages,
  MAX_OPENAI_INPUT_IMAGES,
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

type OpenAIImageData = {
  b64_json?: string;
};

type OpenAIImagesResponse = {
  data?: OpenAIImageData[];
  error?: {
    message?: string;
  };
};

type OpenAIChatContentPart = {
  type?: string;
  text?: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenAIChatContentPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function mapOpenAIData(data: OpenAIImageData[] | undefined): GeneratedImage[] {
  if (!data?.length) {
    return [];
  }

  const images: GeneratedImage[] = [];
  for (const item of data) {
    if (!item.b64_json) {
      continue;
    }
    images.push({
      bytes: base64ToBytes(item.b64_json),
      mimeType: "image/jpeg",
    });
  }
  return images;
}

function textFromChatResponse(payload: OpenAIChatResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => part.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join("\n")
    .trim();
}

async function fileToDataUrl(file: File): Promise<string> {
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "image/png";
  return `data:${mimeType};base64,${data}`;
}

export class OpenAIModelProvider implements ModelProvider {
  constructor(private readonly apiKey: string) {}

  async textToImage(input: TextToImageInput): Promise<GeneratedImage[]> {
    const images = capProviderInputImages(
      MAX_OPENAI_INPUT_IMAGES,
      undefined,
      input.images,
    );
    if (images.length === 0) {
      return this.generateImages(
        (count) => this.requestGenerations(input.prompt, count, input.modelId),
        input.count,
      );
    }

    return this.generateImages(
      (count) => this.requestEdits(input.prompt, count, images, input.modelId),
      input.count,
    );
  }

  async imageAndTextToImage(
    input: ImageAndTextToImageInput,
  ): Promise<GeneratedImage[]> {
    const images = capProviderInputImages(
      MAX_OPENAI_INPUT_IMAGES,
      input.image,
      input.images,
    );
    return this.generateImages(
      (count) => this.requestEdits(input.prompt, count, images, input.modelId),
      input.count,
    );
  }

  async imageToText(input: ImageToTextInput): Promise<string> {
    const imageUrl = await fileToDataUrl(input.image);
    return this.chatComplete(input.modelId, [
      { type: "text", text: input.prompt },
      { type: "image_url", image_url: { url: imageUrl } },
    ]);
  }

  async textToText(input: TextToTextInput): Promise<string> {
    return this.chatComplete(input.modelId, input.prompt);
  }

  private async generateImages(
    request: (count: number) => Promise<GeneratedImage[]>,
    count: number,
  ): Promise<GeneratedImage[]> {
    if (count <= 1) {
      return request(1);
    }

    try {
      return await request(count);
    } catch {
      const results = await Promise.allSettled(
        Array.from({ length: count }, () => request(1)),
      );

      const images: GeneratedImage[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          images.push(...result.value);
        }
      }

      if (images.length === 0) {
        const firstRejection = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        const reason =
          firstRejection?.reason instanceof Error
            ? firstRejection.reason.message
            : "OpenAI returned no images.";
        throw new GenerationUpstreamError(reason);
      }

      return images;
    }
  }

  private async requestGenerations(
    prompt: string,
    count: number,
    modelId: string,
  ): Promise<GeneratedImage[]> {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt,
        n: count,
        size: "1024x1024",
        output_format: "jpeg",
      }),
    });

    return this.readImages(response);
  }

  private async requestEdits(
    prompt: string,
    count: number,
    images: File[],
    modelId: string,
  ): Promise<GeneratedImage[]> {
    const body = new FormData();
    body.set("model", modelId);
    for (const image of images) {
      body.append("image[]", image, image.name || "image.png");
    }
    body.set("prompt", prompt);
    body.set("n", String(count));
    body.set("size", "1024x1024");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body,
    });

    return this.readImages(response);
  }

  private async readImages(response: Response): Promise<GeneratedImage[]> {
    const payload = (await response.json()) as OpenAIImagesResponse;

    if (!response.ok) {
      throw new GenerationUpstreamError(
        payload.error?.message ||
          `OpenAI request failed (${response.status}).`,
      );
    }

    const images = mapOpenAIData(payload.data);
    if (images.length === 0) {
      throw new GenerationUpstreamError("OpenAI response missing image data.");
    }

    return images;
  }

  private async chatComplete(
    modelId: string,
    content: string | Array<Record<string, unknown>>,
  ): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content }],
      }),
    });

    const payload = (await response.json()) as OpenAIChatResponse;
    if (!response.ok) {
      throw new GenerationUpstreamError(
        payload.error?.message ||
          `OpenAI request failed (${response.status}).`,
      );
    }

    const text = textFromChatResponse(payload);
    if (!text) {
      throw new GenerationUpstreamError("OpenAI response missing text.");
    }

    return text;
  }
}
