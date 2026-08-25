import { describe, expect, it } from "vitest";
import { FeedError } from "@/lib/feeds/errors";
import { parseFeedSource } from "@/lib/feeds/parse";

describe("parseFeedSource", () => {
  it("rejects empty input", () => {
    expect(() => parseFeedSource("   ", "instagram")).toThrow(FeedError);
    expect(() => parseFeedSource("", "x")).toThrow(
      "Enter an Instagram or X profile URL or @handle.",
    );
  });

  it("parses Instagram handles and profile URLs", () => {
    expect(parseFeedSource("@cool.user", "instagram")).toEqual({
      platform: "instagram",
      username: "cool.user",
    });
    expect(
      parseFeedSource("https://www.instagram.com/cool.user/", "x"),
    ).toEqual({
      platform: "instagram",
      username: "cool.user",
    });
    expect(parseFeedSource("instagram.com/cool.user", "instagram")).toEqual({
      platform: "instagram",
      username: "cool.user",
    });
  });

  it("parses X handles and profile URLs", () => {
    expect(parseFeedSource("@some_user", "x")).toEqual({
      platform: "x",
      username: "some_user",
    });
    expect(parseFeedSource("https://x.com/some_user", "instagram")).toEqual({
      platform: "x",
      username: "some_user",
    });
    expect(parseFeedSource("https://twitter.com/some_user", "x")).toEqual({
      platform: "x",
      username: "some_user",
    });
    expect(parseFeedSource("https://mobile.x.com/some_user", "x")).toEqual({
      platform: "x",
      username: "some_user",
    });
  });

  it("rejects reserved Instagram and X paths", () => {
    expect(() =>
      parseFeedSource("https://instagram.com/explore", "instagram"),
    ).toThrow("Use an Instagram profile URL or @handle.");
    expect(() => parseFeedSource("https://x.com/home", "x")).toThrow(
      "Use an X profile URL or @handle.",
    );
    expect(() => parseFeedSource("explore", "instagram")).toThrow(
      "Invalid Instagram username: explore",
    );
    expect(() => parseFeedSource("settings", "x")).toThrow(
      "Invalid X username: settings",
    );
  });

  it("falls back to the requested platform for a bare handle", () => {
    expect(parseFeedSource("memeacct", "instagram")).toEqual({
      platform: "instagram",
      username: "memeacct",
    });
    expect(parseFeedSource("memeacct", "x")).toEqual({
      platform: "x",
      username: "memeacct",
    });
  });

  it("rejects handles that fail platform rules", () => {
    expect(() => parseFeedSource("has-dash", "instagram")).toThrow(FeedError);
    expect(() => parseFeedSource("waytoolonghandle12", "x")).toThrow(
      FeedError,
    );
  });
});
