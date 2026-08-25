import { describe, expect, it } from "vitest";
import { NoopStyleAnalyzer } from "@/lib/generation/style/noop-analyzer";
import { makeFile } from "../../../helpers";

describe("NoopStyleAnalyzer", () => {
  it("returns an empty style hint and ignores examples", async () => {
    const analysis = await new NoopStyleAnalyzer().analyze([makeFile()]);
    expect(analysis).toEqual({ styleHint: "" });
    expect(analysis.referenceImages).toBeUndefined();
  });
});
