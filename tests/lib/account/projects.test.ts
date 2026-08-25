import { describe, expect, it } from "vitest";
import { parseStoredExamples } from "@/lib/account/projects";

describe("parseStoredExamples", () => {
  it("returns null for non-arrays and invalid entries", () => {
    expect(parseStoredExamples(null)).toBeNull();
    expect(parseStoredExamples({})).toBeNull();
    expect(
      parseStoredExamples([{ id: "1", name: "a", kind: "other" }]),
    ).toBeNull();
    expect(
      parseStoredExamples([
        { id: "1", name: "a", kind: "upload" },
      ]),
    ).toBeNull();
  });

  it("keeps uploads and skips bundled or /examples/ paths", () => {
    expect(
      parseStoredExamples([
        {
          id: "1",
          name: "keep.jpg",
          kind: "upload",
          previewUrl: "data:image/png;base64,aa",
        },
        {
          id: "2",
          name: "skip.jpg",
          kind: "bundled",
          previewUrl: "/examples/old.jpg",
        },
        {
          id: "3",
          name: "legacy.jpg",
          kind: "upload",
          previewUrl: "/examples/legacy.jpg",
        },
      ]),
    ).toEqual([
      {
        id: "1",
        name: "keep.jpg",
        kind: "upload",
        previewUrl: "data:image/png;base64,aa",
      },
    ]);
  });
});
