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
  "instagram.com",
  "pbs.twimg.com",
  "scontent.cdninstagram.com",
  "www.instagram.com",
]);

const ALLOWED_HOST_SUFFIXES = [
  ".cdninstagram.com",
  ".fbcdn.net",
  ".instagram.com",
  ".twimg.com",
];

function isAllowedImageHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) {
    return true;
  }
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function refererFor(url: URL) {
  if (url.hostname.includes("instagram") || url.hostname.includes("fbcdn")) {
    return "https://www.instagram.com/";
  }
  return "https://x.com/";
}

export async function downloadFeedImage(image: FeedImage): Promise<File> {
  let parsed: URL;
  try {
    parsed = new URL(image.url);
  } catch {
    throw new FeedError("Could not download an image from that feed.", 502);
  }
  if (parsed.protocol !== "https:" || !isAllowedImageHost(parsed.hostname)) {
    throw new FeedError("Could not download an image from that feed.", 502);
  }

  const response = await fetch(parsed, {
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent": USER_AGENT,
      Referer: refererFor(parsed),
    },
  });

  if (!response.ok) {
    throw new FeedError(`Failed downloading image (HTTP ${response.status}).`, 502);
  }

  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_DOWNLOAD_BYTES) {
    throw new FeedError("An image from that feed was too large.", 400);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new FeedError("Could not download an image from that feed.", 502);
  }
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new FeedError("An image from that feed was too large.", 400);
  }

  try {
    return await compressImageBytes(bytes, image.name);
  } catch {
    throw new FeedError("Could not read an image from that feed.", 502);
  }
}
