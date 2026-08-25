import { describe, expect, it } from "vitest";
import { capProviderInputImages } from "@/lib/images/constants";
import { makeFile } from "../../helpers";

describe("capProviderInputImages", () => {
  const source = makeFile("source.png");
  const refs = [
    makeFile("a.png"),
    makeFile("b.png"),
    makeFile("c.png"),
    makeFile("d.png"),
  ];

  it("slices references when there is no source", () => {
    expect(capProviderInputImages(2, undefined, refs)).toEqual(refs.slice(0, 2));
    expect(capProviderInputImages(3)).toEqual([]);
  });

  it("puts the source first and leaves room for references", () => {
    expect(capProviderInputImages(3, source, refs)).toEqual([
      source,
      refs[0],
      refs[1],
    ]);
    expect(capProviderInputImages(1, source, refs)).toEqual([source]);
    expect(capProviderInputImages(0, source, refs)).toEqual([source]);
  });
});
