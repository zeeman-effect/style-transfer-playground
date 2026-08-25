import { describe, expect, it } from "vitest";
import {
  claimFeedImportToken,
  discardFeedImportToken,
  FEED_IMPORT_TOKEN_RE,
  readFeedImportToken,
} from "@/lib/feeds/import-token";

describe("FEED_IMPORT_TOKEN_RE", () => {
  it("matches 64 hex characters only", () => {
    expect(FEED_IMPORT_TOKEN_RE.test("a".repeat(64))).toBe(true);
    expect(FEED_IMPORT_TOKEN_RE.test("A".repeat(64))).toBe(false);
    expect(FEED_IMPORT_TOKEN_RE.test("a".repeat(63))).toBe(false);
    expect(FEED_IMPORT_TOKEN_RE.test("g".repeat(64))).toBe(false);
  });
});

describe("invalid token early returns", () => {
  it("claim, read, and discard skip the database for junk tokens", async () => {
    await expect(claimFeedImportToken("not-a-token")).resolves.toBeNull();
    await expect(readFeedImportToken("short", "user")).resolves.toBeNull();
    await expect(discardFeedImportToken("??", "user")).resolves.toBeUndefined();
  });
});
