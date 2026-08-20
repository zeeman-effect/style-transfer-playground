import { FeedError } from "@/lib/feeds/errors";
import type { FeedPlatform, ParsedFeed } from "@/lib/feeds/types";

const IG_USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;
const X_USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/;

const IG_PROFILE_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)(?:\/|$)/i;
const X_PROFILE_URL_RE =
  /(?:https?:\/\/)?(?:(?:www|mobile)\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)(?:\/|$)/i;

const IG_RESERVED = new Set([
  "about",
  "accounts",
  "api",
  "challenge",
  "developer",
  "developers",
  "directory",
  "emails",
  "error",
  "explore",
  "graphql",
  "legal",
  "lite",
  "p",
  "popular",
  "reel",
  "reels",
  "session",
  "stories",
  "tags",
  "tv",
]);

const X_RESERVED = new Set([
  "about",
  "compose",
  "download",
  "explore",
  "followers",
  "following",
  "hashtag",
  "help",
  "home",
  "i",
  "intent",
  "jobs",
  "login",
  "messages",
  "notifications",
  "privacy",
  "search",
  "settings",
  "share",
  "signup",
  "tos",
]);

function firstPathSegment(url: URL): string | null {
  const segment = url.pathname.split("/").filter(Boolean)[0];
  return segment ? decodeURIComponent(segment) : null;
}

function parseHttpUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
}

function isInstagramHost(host: string): boolean {
  return host === "instagram.com" || host.endsWith(".instagram.com");
}

function isXHost(host: string): boolean {
  return (
    host === "x.com" ||
    host.endsWith(".x.com") ||
    host === "twitter.com" ||
    host.endsWith(".twitter.com")
  );
}

function instagramFromUrl(raw: string): ParsedFeed | null {
  const url = parseHttpUrl(raw);
  if (!url || !isInstagramHost(url.hostname.toLowerCase())) {
    const match = IG_PROFILE_URL_RE.exec(raw);
    if (!match) {
      return null;
    }
    return instagramUsername(match[1]);
  }

  const segment = firstPathSegment(url);
  if (!segment) {
    return null;
  }
  if (IG_RESERVED.has(segment.toLowerCase())) {
    throw new FeedError("Use an Instagram profile URL or @handle.");
  }
  return instagramUsername(segment);
}

function xFromUrl(raw: string): ParsedFeed | null {
  const url = parseHttpUrl(raw);
  if (!url || !isXHost(url.hostname.toLowerCase())) {
    const match = X_PROFILE_URL_RE.exec(raw);
    if (!match) {
      return null;
    }
    return xUsername(match[1]);
  }

  const segment = firstPathSegment(url);
  if (!segment) {
    return null;
  }
  if (X_RESERVED.has(segment.toLowerCase())) {
    throw new FeedError("Use an X profile URL or @handle.");
  }
  return xUsername(segment);
}

function instagramUsername(raw: string): ParsedFeed {
  const username = raw.replace(/^@/, "");
  if (!IG_USERNAME_RE.test(username) || IG_RESERVED.has(username.toLowerCase())) {
    throw new FeedError(`Invalid Instagram username: ${raw}`);
  }
  return { platform: "instagram", username };
}

function xUsername(raw: string): ParsedFeed {
  const username = raw.replace(/^@/, "");
  if (!X_USERNAME_RE.test(username) || X_RESERVED.has(username.toLowerCase())) {
    throw new FeedError(`Invalid X username: ${raw}`);
  }
  return { platform: "x", username };
}

export function parseFeedSource(
  raw: string,
  platform: FeedPlatform,
): ParsedFeed {
  const value = raw.trim();
  if (!value) {
    throw new FeedError("Enter an Instagram or X profile URL or @handle.");
  }

  const instagram = instagramFromUrl(value);
  if (instagram) {
    return instagram;
  }
  const x = xFromUrl(value);
  if (x) {
    return x;
  }

  const handle = value.replace(/^@/, "");
  if (platform === "instagram") {
    return instagramUsername(handle);
  }
  return xUsername(handle);
}
