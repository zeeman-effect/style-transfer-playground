import { describe, expect, it, vi } from "vitest";
import { CompositeReferenceAnalyzer } from "@/lib/generation/style/composite-reference-analyzer";
import { buildCompositeImage } from "@/lib/generation/style/composite-image";
import { makeFile } from "../../../helpers";

vi.mock("@/lib/generation/style/composite-image", () => ({
  buildCompositeImage: vi.fn(),
}));

const buildCompositeImageMock = vi.mocked(buildCompositeImage);

describe("CompositeReferenceAnalyzer", () => {
  it("returns an empty hint when the composite cannot be built", async () => {
    buildCompositeImageMock.mockResolvedValue(null);
    await expect(new CompositeReferenceAnalyzer().analyze([])).resolves.toEqual({
      styleHint: "",
    });
  });

  it("returns a fixed hint and the composite as the only reference", async () => {
    const composite = makeFile("composite.jpg", "image/jpeg");
    buildCompositeImageMock.mockResolvedValue(composite);
    const runLogger = { saveCompositeImage: vi.fn().mockResolvedValue("ok") };
    const analysis = await new CompositeReferenceAnalyzer(
      runLogger as never,
    ).analyze([makeFile()]);
    expect(analysis.styleHint).toContain("style reference sheet");
    expect(analysis.referenceImages).toEqual([composite]);
    expect(runLogger.saveCompositeImage).toHaveBeenCalledWith(composite);
  });
});
