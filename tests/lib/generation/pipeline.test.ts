import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMemeImages } from "@/lib/generation/pipeline";
import { createModelProvider } from "@/lib/generation/providers";
import {
  GenerationClientError,
  GenerationUpstreamError,
} from "@/lib/generation/types";
import { makeFile, makeGeneratedImage, mockModelProvider } from "../../helpers";

vi.mock("@/lib/generation/providers", () => ({
  createModelProvider: vi.fn(),
}));

const createModelProviderMock = vi.mocked(createModelProvider);

function baseInput(
  overrides: Partial<Parameters<typeof generateMemeImages>[0]> = {},
) {
  return {
    prompt: "a cat meme",
    examples: [makeFile()],
    modelId: "gemini-3.1-flash-image",
    analyzerId: "noop",
    count: 1,
    keys: { google: "test-key" },
    ...overrides,
  };
}

describe("generateMemeImages", () => {
  const provider = mockModelProvider();
  const styleAnalyzer = {
    analyze: vi.fn().mockResolvedValue({ styleHint: "chunky Impact captions" }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createModelProviderMock.mockReturnValue(provider);
    styleAnalyzer.analyze.mockResolvedValue({
      styleHint: "chunky Impact captions",
    });
    provider.textToImage = vi
      .fn()
      .mockResolvedValue([makeGeneratedImage(new Uint8Array([1, 2]))]);
    provider.imageAndTextToImage = vi
      .fn()
      .mockResolvedValue([makeGeneratedImage(new Uint8Array([3, 4]))]);
  });

  it("rejects counts outside 1–6", async () => {
    await expect(
      generateMemeImages(baseInput({ count: 0 }), { styleAnalyzer }),
    ).rejects.toBeInstanceOf(GenerationClientError);
    await expect(
      generateMemeImages(baseInput({ count: 7 }), { styleAnalyzer }),
    ).rejects.toMatchObject({
      name: "GenerationClientError",
      message: "Count must be an integer from 1 to 6.",
    });
    await expect(
      generateMemeImages(baseInput({ count: 1.5 }), { styleAnalyzer }),
    ).rejects.toBeInstanceOf(GenerationClientError);
  });

  it("uses textToImage when there is no source image", async () => {
    const result = await generateMemeImages(baseInput({ count: 2 }), {
      styleAnalyzer,
    });

    expect(provider.textToImage).toHaveBeenCalledOnce();
    expect(provider.imageAndTextToImage).not.toHaveBeenCalled();
    const call = vi.mocked(provider.textToImage).mock.calls[0][0];
    expect(call.count).toBe(2);
    expect(call.modelId).toBe("gemini-3.1-flash-image");
    expect(call.prompt).toContain("a cat meme");
    expect(call.prompt).toContain("Style guidance: chunky Impact captions");
    expect(result.styleHint).toBe("chunky Impact captions");
    expect(result.images[0]).toMatch(/^data:image\/png;base64,/);
  });

  it("uses imageAndTextToImage when a source image is provided", async () => {
    const source = makeFile("source.png");
    await generateMemeImages(baseInput({ sourceImage: source }), {
      styleAnalyzer,
    });

    expect(provider.imageAndTextToImage).toHaveBeenCalledOnce();
    expect(provider.textToImage).not.toHaveBeenCalled();
    expect(
      vi.mocked(provider.imageAndTextToImage).mock.calls[0][0].image,
    ).toBe(source);
  });

  it("throws GenerationUpstreamError when the provider returns no images", async () => {
    vi.mocked(provider.textToImage).mockResolvedValue([]);
    await expect(
      generateMemeImages(baseInput(), { styleAnalyzer }),
    ).rejects.toMatchObject({
      name: "GenerationUpstreamError",
      status: 502,
      message: "No images were generated.",
    });
    expect(GenerationUpstreamError).toBeTruthy();
  });

  it("omits style guidance when the hint is blank", async () => {
    styleAnalyzer.analyze.mockResolvedValue({ styleHint: "   " });
    await generateMemeImages(baseInput(), { styleAnalyzer });
    const prompt = vi.mocked(provider.textToImage).mock.calls[0][0].prompt;
    expect(prompt).toContain("a cat meme");
    expect(prompt).not.toContain("Style guidance:");
  });

  it("passes analyzer reference images to the provider", async () => {
    const refs = [makeFile("ref.png")];
    styleAnalyzer.analyze.mockResolvedValue({
      styleHint: "grain",
      referenceImages: refs,
    });
    await generateMemeImages(baseInput(), { styleAnalyzer });
    expect(vi.mocked(provider.textToImage).mock.calls[0][0].images).toBe(refs);
  });
});
