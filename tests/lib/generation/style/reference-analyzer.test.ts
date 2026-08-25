import { describe, expect, it } from "vitest";
import { ReferenceStyleAnalyzer } from "@/lib/generation/style/reference-analyzer";
import { makeFile } from "../../../helpers";

describe("ReferenceStyleAnalyzer", () => {
  it("returns an empty hint when there are no examples", async () => {
    await expect(new ReferenceStyleAnalyzer().analyze([])).resolves.toEqual({
      styleHint: "",
    });
  });

  it("returns a fixed hint and the examples as references", async () => {
    const examples = [makeFile("a.png"), makeFile("b.png")];
    const analysis = await new ReferenceStyleAnalyzer().analyze(examples);
    expect(analysis.styleHint).toContain("Match the attached reference images");
    expect(analysis.referenceImages).toBe(examples);
  });
});
