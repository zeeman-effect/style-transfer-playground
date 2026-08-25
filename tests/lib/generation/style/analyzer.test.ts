import { describe, expect, it, vi } from "vitest";
import { VISION_ANALYSIS_BATCH } from "@/lib/images/constants";
import { DeepStyleAnalyzer } from "@/lib/generation/style/analyzer";
import { makeFile, mockModelProvider } from "../../../helpers";

describe("DeepStyleAnalyzer", () => {
  it("returns an empty hint when there are no examples", async () => {
    const provider = mockModelProvider();
    const analyzer = new DeepStyleAnalyzer(provider, "gemini-3.6-flash");
    await expect(analyzer.analyze([])).resolves.toEqual({ styleHint: "" });
    expect(provider.imageToText).not.toHaveBeenCalled();
    expect(provider.textToText).not.toHaveBeenCalled();
  });

  it("describes each example then synthesizes a style paragraph", async () => {
    const provider = mockModelProvider({
      imageToText: vi.fn().mockResolvedValue("grainy captions"),
      textToText: vi.fn().mockResolvedValue("final profile"),
    });
    const examples = [makeFile("a.png"), makeFile("b.png")];
    const analyzer = new DeepStyleAnalyzer(provider, "gemini-3.6-flash");
    await expect(analyzer.analyze(examples)).resolves.toEqual({
      styleHint: "final profile",
    });
    expect(provider.imageToText).toHaveBeenCalledTimes(2);
    expect(vi.mocked(provider.imageToText).mock.calls[0][0]).toMatchObject({
      image: examples[0],
      modelId: "gemini-3.6-flash",
    });
    expect(provider.textToText).toHaveBeenCalledOnce();
    const synthesis = vi.mocked(provider.textToText).mock.calls[0][0];
    expect(synthesis.prompt).toContain("1. grainy captions");
    expect(synthesis.prompt).toContain("2. grainy captions");
    expect(synthesis.modelId).toBe("gemini-3.6-flash");
  });

  it("skips synthesis when every vision result is blank", async () => {
    const provider = mockModelProvider({
      imageToText: vi.fn().mockResolvedValue("   "),
    });
    const analyzer = new DeepStyleAnalyzer(provider, "gpt-4.1");
    await expect(analyzer.analyze([makeFile()])).resolves.toEqual({
      styleHint: "",
    });
    expect(provider.textToText).not.toHaveBeenCalled();
  });

  it("analyzes examples in batches of VISION_ANALYSIS_BATCH", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const provider = mockModelProvider({
      imageToText: vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return "notes";
      }),
      textToText: vi.fn().mockResolvedValue("profile"),
    });
    const count = VISION_ANALYSIS_BATCH + 1;
    const examples = Array.from({ length: count }, (_, index) =>
      makeFile(`ex-${index}.png`),
    );
    await new DeepStyleAnalyzer(provider, "gemini-3.6-flash").analyze(examples);
    expect(provider.imageToText).toHaveBeenCalledTimes(count);
    expect(maxInFlight).toBe(VISION_ANALYSIS_BATCH);
    expect(provider.textToText).toHaveBeenCalledOnce();
  });
});
