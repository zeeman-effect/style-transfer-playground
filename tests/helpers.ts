import { vi } from "vitest";
import type { ModelProvider } from "@/lib/generation/providers/types";
import type { GeneratedImage } from "@/lib/generation/types";

export function makeFile(
  name = "example.png",
  type = "image/png",
  bytes: Uint8Array<ArrayBuffer> = new Uint8Array([1, 2, 3]),
): File {
  return new File([bytes], name, { type });
}

export function makeGeneratedImage(
  bytes: Uint8Array = new Uint8Array([9, 8, 7]),
  mimeType = "image/png",
): GeneratedImage {
  return { bytes, mimeType };
}

export function mockModelProvider(
  overrides: Partial<ModelProvider> = {},
): ModelProvider {
  return {
    textToImage: vi.fn().mockResolvedValue([makeGeneratedImage()]),
    imageAndTextToImage: vi.fn().mockResolvedValue([makeGeneratedImage()]),
    imageToText: vi.fn().mockResolvedValue("visual style notes"),
    textToText: vi.fn().mockResolvedValue("synthesized style profile"),
    ...overrides,
  };
}
