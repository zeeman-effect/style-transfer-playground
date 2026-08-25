import { describe, expect, it } from "vitest";
import { projectExampleImageUrl } from "@/lib/account/examples";

describe("projectExampleImageUrl", () => {
  it("builds the example image API path", () => {
    expect(projectExampleImageUrl("proj", "ex1")).toBe(
      "/api/projects/proj/examples/ex1/image",
    );
  });
});
