import { describe, expect, it } from "vitest";
import {
  instagramImportBookmarklet,
  parseInstagramImportStatus,
} from "@/lib/feeds/instagram-import-client";

describe("parseInstagramImportStatus", () => {
  it("treats non-objects and unknown statuses as unknown", () => {
    expect(parseInstagramImportStatus(null)).toEqual({
      status: "unknown",
      projectId: undefined,
      examples: [],
      error: null,
    });
    expect(parseInstagramImportStatus({ status: "weird" }).status).toBe(
      "unknown",
    );
  });

  it("keeps pending, done, and error plus valid examples", () => {
    const parsed = parseInstagramImportStatus({
      status: "done",
      projectId: "proj-1",
      examples: [
        { id: "e1", name: "a.jpg", previewUrl: "/a" },
        { id: 2, name: "skip" },
      ],
      error: "boom",
    });
    expect(parsed).toEqual({
      status: "done",
      projectId: "proj-1",
      examples: [
        { id: "e1", name: "a.jpg", kind: "upload", previewUrl: "/a" },
      ],
      error: "boom",
    });
    expect(parseInstagramImportStatus({ status: "pending" }).status).toBe(
      "pending",
    );
    expect(parseInstagramImportStatus({ status: "error" }).status).toBe("error");
  });
});

describe("instagramImportBookmarklet", () => {
  it("prefixes the script with javascript:", () => {
    const bookmarklet = instagramImportBookmarklet({
      relayUrl: "https://app.example/ig-import-relay.html",
      relayWindowName: "style-transfer-ig-relay",
      token: "abc",
      username: "acct",
      count: 4,
    });
    expect(bookmarklet.startsWith("javascript:")).toBe(true);
    expect(decodeURIComponent(bookmarklet.slice("javascript:".length))).toContain(
      '"token":"abc"',
    );
  });
});
