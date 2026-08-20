import { FeedError } from "@/lib/feeds/errors";
import type { FeedImage } from "@/lib/feeds/types";
import { compressImageBytes } from "@/lib/images/compress-server";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_DOWNLOAD_BYTES = 8_000_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

const ALLOWED_HOSTS = new Set([
  "cdninstagram.com",
  "fbcdn.net",
  "i.instagram.com",
  "images.weserv.nl",
  "instagram.com",
  "pbs.twimg.com",
  "scontent.cdninstagram.com",
  "www.instagram.com",
  "wsrv.nl",
]);

const ALLOWED_HOST_SUFFIXES = [
  ".cdninstagram.com",
  ".fbcdn.net",
  ".instagram.com",
  ".twimg.com",
];

function downloadFailureMessage(hostname: string) {
  const host = hostname.toLowerCase();
  if (
    host === "wsrv.nl" ||
    host === "images.weserv.nl" ||
    host.includes("instagram")
  ) {
    return "Instagram images could not be downloaded. Wait a moment and try Pull again, or upload images instead.";
  }
  return "Could not download images from that feed. Try Pull again, or upload images instead.";
}

function isAllowedImageHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) {
    return true;
  }
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function refererFor(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host === "wsrv.nl" || host === "images.weserv.nl") {
    return "";
  }
  if (host.includes("instagram") || host.includes("fbcdn")) {
    return "https://www.instagram.com/";
  }
  return "https://x.com/";
}

function looksLikeImage(bytes: Buffer) {
  if (bytes.byteLength < 12) {
    return false;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return true;
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return true;
  }
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true;
  }
  return bytes.toString("ascii", 0, 3) === "GIF";
}

export async function downloadFeedImage(image: FeedImage): Promise<File> {
  let parsed: URL;
  try {
    parsed = new URL(image.url);
  } catch {
    throw new FeedError(
      "Could not download images from that feed. Try Pull again, or upload images instead.",
      502,
    );
  }
  if (parsed.protocol !== "https:" || !isAllowedImageHost(parsed.hostname)) {
    throw new FeedError(downloadFailureMessage(parsed.hostname), 502);
  }

  const headers: Record<string, string> = {
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "User-Agent": USER_AGENT,
  };
  const referer = refererFor(parsed);
  if (referer) {
    headers.Referer = referer;
  }

  let response: Response;
  try {
    response = await fetch(parsed, {
      redirect: "follow",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers,
    });
  } catch {
    throw new FeedError(downloadFailureMessage(parsed.hostname), 502);
  }

  if (!response.ok) {
    throw new FeedError(downloadFailureMessage(parsed.hostname), 502);
  }

  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_DOWNLOAD_BYTES) {
    throw new FeedError("An image from that feed was too large.", 400);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new FeedError(downloadFailureMessage(parsed.hostname), 502);
  }
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new FeedError("An image from that feed was too large.", 400);
  }
  const ctype = String(response.headers.get("content-type") || "");
  if (
    ctype.includes("text/html") ||
    ctype.includes("application/json") ||
    !looksLikeImage(bytes)
  ) {
    throw new FeedError(downloadFailureMessage(parsed.hostname), 502);
  }

  try {
    return await compressImageBytes(bytes, image.name);
  } catch {
    throw new FeedError(downloadFailureMessage(parsed.hostname), 502);
  }
}
