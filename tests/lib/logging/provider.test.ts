import { describe, expect, it, vi } from "vitest";
import { LoggingModelProvider } from "@/lib/logging/provider";
import type { GenerationRunLogger } from "@/lib/logging/run";
import { makeFile, makeGeneratedImage, mockModelProvider } from "../../helpers";

function mockRun() {
  return {
    nextCallSeq: vi.fn().mockReturnValue(1),
    saveCallInputImage: vi.fn().mockResolvedValue("in.png"),
    saveCallOutputImages: vi.fn().mockResolvedValue(["out.png"]),
    recordCall: vi.fn().mockResolvedValue(undefined),
  };
}

describe("LoggingModelProvider", () => {
  it("records a successful textToImage call", async () => {
    const images = [makeGeneratedImage()];
    const inner = mockModelProvider({
      textToImage: vi.fn().mockResolvedValue(images),
    });
    const run = mockRun();
    const provider = new LoggingModelProvider(
      inner,
      run as unknown as GenerationRunLogger,
    );
    const refs = [makeFile("ref.png")];
    await expect(
      provider.textToImage({
        prompt: "draw",
        count: 1,
        modelId: "gpt-image-2",
        images: refs,
      }),
    ).resolves.toBe(images);
    expect(inner.textToImage).toHaveBeenCalledOnce();
    expect(run.saveCallInputImage).toHaveBeenCalled();
    expect(run.saveCallOutputImages).toHaveBeenCalledWith(1, images);
    expect(run.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        seq: 1,
        kind: "textToImage",
        provider: "openai",
        modelId: "gpt-image-2",
        prompt: "draw",
        outputImagePaths: ["out.png"],
      }),
    );
  });

  it("records an error and rethrows", async () => {
    const inner = mockModelProvider({
      textToText: vi.fn().mockRejectedValue(new Error("upstream")),
    });
    const run = mockRun();
    const provider = new LoggingModelProvider(
      inner,
      run as unknown as GenerationRunLogger,
    );
    await expect(
      provider.textToText({ prompt: "hi", modelId: "gemini-3.6-flash" }),
    ).rejects.toThrow("upstream");
    expect(run.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "textToText",
        provider: "google",
        error: "upstream",
        outputImagePaths: [],
      }),
    );
  });

  it("wraps imageAndTextToImage and imageToText", async () => {
    const inner = mockModelProvider({
      imageAndTextToImage: vi.fn().mockResolvedValue([makeGeneratedImage()]),
      imageToText: vi.fn().mockResolvedValue("caption"),
    });
    const run = mockRun();
    const provider = new LoggingModelProvider(
      inner,
      run as unknown as GenerationRunLogger,
    );
    const source = makeFile("src.png");
    await provider.imageAndTextToImage({
      prompt: "edit",
      count: 1,
      modelId: "gemini-3.1-flash-image",
      image: source,
    });
    await expect(
      provider.imageToText({
        prompt: "look",
        modelId: "gemini-3.6-flash",
        image: source,
      }),
    ).resolves.toBe("caption");
    expect(run.recordCall).toHaveBeenCalledTimes(2);
  });
});
