import { FeedError } from "@/lib/feeds/errors";
import type { FeedImage } from "@/lib/feeds/types";

const FX_ORIGIN = "https://api.fxtwitter.com";
const SYNDICATION_ORIGIN = "https://syndication.twitter.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_PAGES = 3;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function sizedTwimgUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "pbs.twimg.com" ||
      parsed.hostname.endsWith(".twimg.com")
    ) {
      parsed.searchParams.set("name", "large");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function photosFromStatus(status: unknown): FeedImage[] {
  const record = asRecord(status);
  if (!record) {
    return [];
  }
  const id = String(record.id || "");
  const author = asRecord(record.author);
  const handle = String(author?.screen_name || "x");
  const media = asRecord(record.media);
  const photos =
    Array.isArray(media?.photos) && media.photos.length > 0
      ? media.photos
      : Array.isArray(media?.all)
        ? media.all
        : [];
  const images: FeedImage[] = [];
  let part = 0;
  for (const photo of photos) {
    const item = asRecord(photo);
    if (!item) {
      continue;
    }
    const type = String(item.type || "photo");
    if (type !== "photo" && type !== "gif") {
      continue;
    }
    const url = String(item.url || "");
    if (!url) {
      continue;
    }
    part += 1;
    images.push({
      url: sizedTwimgUrl(url),
      name: `${handle}_${id}_${String(part).padStart(2, "0")}.jpg`,
    });
  }
  return images;
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
  });
  const text = await response.text();
  const json = (() => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  })();
  return { status: response.status, json, text };
}

function fxErrorMessage(payload: Record<string, unknown> | null, fallback: string) {
  const message = String(payload?.message || "").trim();
  return message || fallback;
}

async function listFromFxTwitter(username: string, count: number): Promise<FeedImage[]> {
  const images: FeedImage[] = [];
  let cursor: string | undefined;
  let pages = 0;

  while (images.length < count && pages < MAX_PAGES) {
    pages += 1;
    const url = new URL(
      `${FX_ORIGIN}/2/profile/${encodeURIComponent(username)}/media`,
    );
    url.searchParams.set("count", "20");
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const raw = await fetchJson(url.toString());
    const payload = asRecord(raw.json);
    const code = Number(payload?.code || raw.status);

    if (code === 404 || raw.status === 404) {
      const message = fxErrorMessage(payload, "");
      if (/suspend/i.test(message)) {
        throw new FeedError(`X account @${username} is suspended.`, 404);
      }
      throw new FeedError(`X account not found: ${username}`, 404);
    }
    if (code === 401 || raw.status === 401 || /protect/i.test(String(payload?.message))) {
      throw new FeedError(`@${username} is protected.`, 400);
    }
    if (raw.status === 429 || code === 429) {
      throw new FeedError("X rate-limited the request. Wait and try again.", 429);
    }
    if (raw.status >= 400 || (code && code >= 400)) {
      throw new FeedError(
        fxErrorMessage(payload, `Could not load that X profile (HTTP ${raw.status}).`),
        502,
      );
    }

    const results = Array.isArray(payload?.results) ? payload.results : [];
    for (const status of results) {
      for (const image of photosFromStatus(status)) {
        images.push(image);
        if (images.length >= count) {
          return images;
        }
      }
    }

    const next = asRecord(payload?.cursor);
    const bottom = String(next?.bottom || "");
    if (!bottom || results.length === 0) {
      break;
    }
    cursor = bottom;
  }

  return images;
}

function collectSyndicationPhotos(value: unknown, images: FeedImage[], seen: Set<string>) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSyndicationPhotos(entry, images, seen);
    }
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }

  const mediaUrl = String(
    record.media_url_https || record.media_url || record.display_url || "",
  );
  const type = String(record.type || record.expanded_url || "");
  const looksLikePhoto =
    /pbs\.twimg\.com\/media\//i.test(mediaUrl) ||
    type === "photo" ||
    /\/photo\//i.test(String(record.expanded_url || record.url || ""));
  if (looksLikePhoto && /pbs\.twimg\.com\/media\//i.test(mediaUrl) && !seen.has(mediaUrl)) {
    seen.add(mediaUrl);
    const id = String(record.id_str || record.id || seen.size);
    images.push({
      url: sizedTwimgUrl(mediaUrl),
      name: `x_${id}_${String(images.length + 1).padStart(2, "0")}.jpg`,
    });
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      collectSyndicationPhotos(nested, images, seen);
    }
  }
}

async function listFromSyndication(username: string, count: number): Promise<FeedImage[]> {
  const response = await fetch(
    `${SYNDICATION_ORIGIN}/srv/timeline-profile/screen-name/${encodeURIComponent(username)}`,
    {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    },
  );
  const html = await response.text();
  if (response.status === 404) {
    throw new FeedError(`X account not found: ${username}`, 404);
  }
  if (!response.ok) {
    throw new FeedError(`Could not load that X profile (HTTP ${response.status}).`, 502);
  }

  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/,
  );
  if (!match) {
    throw new FeedError("Could not load that X profile.", 502);
  }

  const data = parseJsonSafe(match[1]);
  const images: FeedImage[] = [];
  collectSyndicationPhotos(data, images, new Set());
  return images.slice(0, count);
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function profileIsProtected(username: string): Promise<boolean> {
  try {
    const raw = await fetchJson(
      `${FX_ORIGIN}/2/profile/${encodeURIComponent(username)}`,
    );
    const payload = asRecord(raw.json);
    const user = asRecord(payload?.user);
    return Boolean(user?.protected);
  } catch {
    return false;
  }
}

export async function listXFeedImages(
  username: string,
  count: number,
): Promise<FeedImage[]> {
  try {
    const images = await listFromFxTwitter(username, count);
    if (images.length > 0) {
      return images;
    }
    if (await profileIsProtected(username)) {
      throw new FeedError(`@${username} is protected.`, 400);
    }
    return images;
  } catch (error) {
    if (error instanceof FeedError && (error.status === 404 || error.status === 400)) {
      throw error;
    }
    try {
      const fallback = await listFromSyndication(username, count);
      if (fallback.length > 0) {
        return fallback;
      }
    } catch (fallbackError) {
      if (fallbackError instanceof FeedError && fallbackError.status === 404) {
        throw fallbackError;
      }
    }
    throw error instanceof FeedError
      ? error
      : new FeedError("Could not load that X profile.", 502);
  }
}
