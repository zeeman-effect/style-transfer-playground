import { describe, expect, it } from "vitest";
import {
  parseDataUrl,
  projectGenerationImageUrl,
} from "@/lib/account/generations";

describe("projectGenerationImageUrl", () => {
  it("builds the generation image API path", () => {
    expect(projectGenerationImageUrl("p1", "g1", "i1")).toBe(
      "/api/projects/p1/generations/g1/images/i1",
    );
  });
});

describe("parseDataUrl", () => {
  it("parses a base64 data URL", () => {
    const parsed = parseDataUrl("data:image/png;base64,aGVsbG8=");
    expect(parsed).not.toBeNull();
    expect(parsed?.mimeType).toBe("image/png");
    expect(parsed?.bytes.toString("utf8")).toBe("hello");
  });

  it("returns null for invalid payloads", () => {
    expect(parseDataUrl("")).toBeNull();
    expect(parseDataUrl("https://example.com/a.png")).toBeNull();
    expect(parseDataUrl("data:image/png,not-base64")).toBeNull();
    expect(parseDataUrl("data:;base64,aaaa")).toBeNull();
  });
});
