import { describe, expect, it, vi } from "vitest";
import { CompositeAnalyzer } from "@/lib/generation/style/composite-analyzer";
import { buildCompositeImage } from "@/lib/generation/style/composite-image";
import { makeFile, mockModelProvider } from "../../../helpers";

vi.mock("@/lib/generation/style/composite-image", () => ({
  buildCompositeImage: vi.fn(),
}));

const buildCompositeImageMock = vi.mocked(buildCompositeImage);

describe("CompositeAnalyzer", () => {
  it("returns an empty hint when the composite cannot be built", async () => {
    buildCompositeImageMock.mockResolvedValue(null);
    const provider = mockModelProvider();
    const analyzer = new CompositeAnalyzer(provider, "gemini-3.6-flash");
    await expect(analyzer.analyze([makeFile()])).resolves.toEqual({
      styleHint: "",
    });
    expect(provider.imageToText).not.toHaveBeenCalled();
  });

  it("sends the composite to the vision model and logs it", async () => {
    const composite = makeFile("composite.jpg", "image/jpeg");
    buildCompositeImageMock.mockResolvedValue(composite);
    const provider = mockModelProvider({
      imageToText: vi.fn().mockResolvedValue("shared look"),
    });
    const runLogger = { saveCompositeImage: vi.fn().mockResolvedValue("ok") };
    const analyzer = new CompositeAnalyzer(
      provider,
      "gemini-3.6-flash",
      runLogger as never,
    );
    await expect(analyzer.analyze([makeFile()])).resolves.toEqual({
      styleHint: "shared look",
    });
    expect(runLogger.saveCompositeImage).toHaveBeenCalledWith(composite);
    expect(provider.imageToText).toHaveBeenCalledWith({
      image: composite,
      prompt: expect.stringContaining("style reference sheet"),
      modelId: "gemini-3.6-flash",
    });
  });
});
