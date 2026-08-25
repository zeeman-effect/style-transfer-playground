import { describe, expect, it } from "vitest";
import {
  INSTAGRAM_SHORTCODE_RE,
  instagramMediaProxyUrl,
  isInstagramCdnUrl,
  listInstagramImages,
  listInstagramImagesByShortcodes,
} from "@/lib/feeds/instagram";

describe("isInstagramCdnUrl", () => {
  it("accepts https Instagram CDN hosts", () => {
    expect(
      isInstagramCdnUrl("https://scontent.cdninstagram.com/v/t51.jpg"),
    ).toBe(true);
    expect(isInstagramCdnUrl("https://cdninstagram.com/v/t51.jpg")).toBe(true);
    expect(isInstagramCdnUrl("https://scontent.xx.fbcdn.net/v/t.jpg")).toBe(
      true,
    );
    expect(isInstagramCdnUrl("https://fbcdn.net/v/t.jpg")).toBe(true);
  });

  it("rejects non-https, other hosts, and invalid URLs", () => {
    expect(isInstagramCdnUrl("http://scontent.cdninstagram.com/v.jpg")).toBe(
      false,
    );
    expect(isInstagramCdnUrl("https://example.com/photo.jpg")).toBe(false);
    expect(isInstagramCdnUrl("not a url")).toBe(false);
  });
});

describe("instagram shortcodes", () => {
  it("accepts typical shortcodes and rejects junk", () => {
    expect(INSTAGRAM_SHORTCODE_RE.test("Cabcde123")).toBe(true);
    expect(INSTAGRAM_SHORTCODE_RE.test("ab")).toBe(false);
    expect(INSTAGRAM_SHORTCODE_RE.test("has space")).toBe(false);
  });

  it("builds a wsrv media proxy URL", () => {
    const url = instagramMediaProxyUrl("AbC12");
    expect(url).toContain("wsrv.nl");
    expect(url).toContain(encodeURIComponent("https://www.instagram.com/p/AbC12/media/?size=l"));
  });
});

describe("listInstagramImages", () => {
  it("prefers aligned CDN urls and names them with the shortcode", () => {
    const images = listInstagramImages(
      "acct",
      ["CodeOne", "CodeTwo"],
      [
        "https://scontent.cdninstagram.com/one.jpg",
        "https://scontent.cdninstagram.com/two.jpg",
      ],
      8,
    );
    expect(images).toEqual([
      {
        url: "https://scontent.cdninstagram.com/one.jpg",
        name: "acct_CodeOne_01.jpg",
      },
      {
        url: "https://scontent.cdninstagram.com/two.jpg",
        name: "acct_CodeTwo_01.jpg",
      },
    ]);
  });

  it("falls back to shortcode proxies when no CDN urls survive", () => {
    const images = listInstagramImages(
      "acct",
      ["CodeOne", "xx", "CodeOne"],
      ["https://example.com/not-cdn.jpg"],
      2,
    );
    expect(images).toEqual([
      {
        url: instagramMediaProxyUrl("CodeOne"),
        name: "acct_CodeOne_01.jpg",
      },
    ]);
    expect(listInstagramImagesByShortcodes("acct", ["CodeOne"], 1)).toEqual(
      images,
    );
  });

  it("stops at the requested count and skips duplicate urls", () => {
    const url = "https://scontent.cdninstagram.com/one.jpg";
    const images = listInstagramImages("acct", ["A", "B"], [url, url], 1);
    expect(images).toHaveLength(1);
    expect(images[0].url).toBe(url);
  });
});
