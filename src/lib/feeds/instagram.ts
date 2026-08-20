import type { FeedImage } from "@/lib/feeds/types";

export const INSTAGRAM_SHORTCODE_RE = /^[A-Za-z0-9_-]{5,64}$/;

export function instagramMediaProxyUrl(shortcode: string) {
  const media = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  return `https://wsrv.nl/?url=${encodeURIComponent(media)}&output=jpg`;
}

export function isInstagramCdnUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return (
      host === "cdninstagram.com" ||
      host.endsWith(".cdninstagram.com") ||
      host === "fbcdn.net" ||
      host.endsWith(".fbcdn.net")
    );
  } catch {
    return false;
  }
}

export function listInstagramImagesByShortcodes(
  username: string,
  shortcodes: string[],
  count: number,
): FeedImage[] {
  const images: FeedImage[] = [];
  const seen = new Set<string>();
  for (const raw of shortcodes) {
    const code = raw.trim();
    if (!INSTAGRAM_SHORTCODE_RE.test(code) || seen.has(code)) {
      continue;
    }
    seen.add(code);
    images.push({
      url: instagramMediaProxyUrl(code),
      name: `${username}_${code}_01.jpg`,
    });
    if (images.length >= count) {
      break;
    }
  }
  return images;
}

export function listInstagramImages(
  username: string,
  shortcodes: string[],
  urls: string[],
  count: number,
): FeedImage[] {
  const fromCdn: FeedImage[] = [];
  const seenUrls = new Set<string>();
  // Carousels contribute several urls per shortcode, and duplicate shortcodes
  // are dropped upstream, so positional pairing is only meaningful when the two
  // lists still line up.
  const aligned = urls.length === shortcodes.length;
  for (const [index, raw] of urls.entries()) {
    const url = raw.trim();
    if (!isInstagramCdnUrl(url) || seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);
    const code = aligned ? shortcodes[index]?.trim() : undefined;
    const stem =
      code && INSTAGRAM_SHORTCODE_RE.test(code)
        ? `${username}_${code}`
        : `${username}_${String(fromCdn.length + 1).padStart(2, "0")}`;
    fromCdn.push({
      url,
      name: `${stem}_01.jpg`,
    });
    if (fromCdn.length >= count) {
      return fromCdn;
    }
  }
  if (fromCdn.length > 0) {
    return fromCdn;
  }
  return listInstagramImagesByShortcodes(username, shortcodes, count);
}
