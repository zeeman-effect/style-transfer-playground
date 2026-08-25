import { describe, expect, it } from "vitest";
import {
  GenerationClientError,
  GenerationUpstreamError,
} from "@/lib/generation/types";

describe("generation error classes", () => {
  it("GenerationClientError is a 400 Error", () => {
    const error = new GenerationClientError("bad input");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GenerationClientError");
    expect(error.status).toBe(400);
    expect(error.message).toBe("bad input");
  });

  it("GenerationUpstreamError is a 502 Error", () => {
    const error = new GenerationUpstreamError("upstream failed");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GenerationUpstreamError");
    expect(error.status).toBe(502);
    expect(error.message).toBe("upstream failed");
  });
});
