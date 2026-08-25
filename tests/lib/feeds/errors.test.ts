import { describe, expect, it } from "vitest";
import { FeedError } from "@/lib/feeds/errors";

describe("FeedError", () => {
  it("defaults to status 400 and accepts an override", () => {
    const basic = new FeedError("nope");
    expect(basic).toBeInstanceOf(Error);
    expect(basic.name).toBe("FeedError");
    expect(basic.status).toBe(400);
    expect(basic.message).toBe("nope");
    expect(new FeedError("down", 502).status).toBe(502);
  });
});
