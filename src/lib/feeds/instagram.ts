import { randomBytes } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { FeedError } from "@/lib/feeds/errors";
import type { FeedImage } from "@/lib/feeds/types";
import { COMPRESS_MAX_EDGE } from "@/lib/images/constants";

const IG_APP_ID = "936619743392459";
const IG_ORIGIN = "https://www.instagram.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_PAGES = 4;
const PAGE_DELAY_MS = 500;
const MAX_REDIRECTS = 5;

type IgUser = {
  id?: string;
  pk?: string;
  username?: string;
  is_private?: boolean;
  followed_by_viewer?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function htmlTitle(text: string) {
  const match = text.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

function parseCookieHeader(header: string) {
  const map = new Map<string, string>();
  if (!header) {
    return map;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return map;
}

function cookieHeader(map: Map<string, string>) {
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function applySetCookie(map: Map<string, string>, setCookie: string[] | undefined) {
  for (const line of setCookie ?? []) {
    const pair = line.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function datePrefix(unixSeconds: number) {
  const date = new Date(Number(unixSeconds || 0) * 1000);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) {
    return "00000000";
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function pickCandidateUrl(item: Record<string, unknown>): string | null {
  const versions = asRecord(item.image_versions2);
  const candidates = Array.isArray(versions?.candidates) ? versions.candidates : [];
  const sized = candidates
    .map((entry) => {
      const record = asRecord(entry);
      return {
        url: String(record?.url || ""),
        edge: Math.max(Number(record?.width) || 0, Number(record?.height) || 0),
      };
    })
    .filter((entry) => entry.url);
  if (sized.length === 0) {
    const display = String(item.display_uri || item.display_url || "");
    return display || null;
  }
  const enough = sized
    .filter((entry) => entry.edge >= COMPRESS_MAX_EDGE)
    .sort((a, b) => a.edge - b.edge);
  if (enough[0]) {
    return enough[0].url;
  }
  return sized.sort((a, b) => b.edge - a.edge)[0]?.url ?? null;
}

function isVideoRest(item: Record<string, unknown>) {
  return (
    Number(item.media_type) === 2 ||
    String(item.__typename || "").includes("Video") ||
    Boolean(item.video_versions)
  );
}

function imagesFromRestItem(item: Record<string, unknown>) {
  const shortcode = String(item.code || item.pk || "");
  const takenAt = Number(item.taken_at || item.device_timestamp || 0);
  const slides = Array.isArray(item.carousel_media)
    ? item.carousel_media
    : [item];
  const images: Array<{ part: number; url: string; shortcode: string; takenAt: number }> = [];
  let part = 0;
  for (const slide of slides) {
    const record = asRecord(slide) ?? (slide === item ? item : null);
    if (!record) {
      continue;
    }
    if (isVideoRest(record) && !pickCandidateUrl(record)) {
      continue;
    }
    if (Number(record.media_type) === 2) {
      continue;
    }
    const url = pickCandidateUrl(record);
    if (!url) {
      continue;
    }
    part += 1;
    images.push({ part, url, shortcode, takenAt });
  }
  return images;
}

function walk(value: unknown, visit: (entry: Record<string, unknown>) => void, depth = 0) {
  if (depth > 40 || !value) {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      walk(entry, visit, depth + 1);
    }
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  visit(record);
  for (const nested of Object.values(record)) {
    walk(nested, visit, depth + 1);
  }
}

function parseUserFromHtml(html: string): IgUser | null {
  const scripts = [...html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)];
  let found: IgUser | null = null;
  for (const match of scripts) {
    const body = match[1];
    if (!body.includes("xig_user_by_username")) {
      continue;
    }
    const json = parseJsonSafe(body);
    walk(json, (record) => {
      const user = asRecord(record.xig_user_by_username);
      if (user?.pk && user.username) {
        found = {
          id: String(user.pk),
          pk: String(user.pk),
          username: String(user.username),
          is_private: Boolean(user.is_private),
          followed_by_viewer: Boolean(user.followed_by_viewer),
        };
      }
    });
    if (found) {
      return found;
    }
  }
  return found;
}

function imagesFromHtml(html: string): Array<{ part: number; url: string; shortcode: string; takenAt: number }> {
  const scripts = [...html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const images: Array<{ part: number; url: string; shortcode: string; takenAt: number }> = [];
  const seen = new Set<string>();
  for (const match of scripts) {
    const body = match[1];
    if (!body.includes("polaris_ordered_timeline_connection")) {
      continue;
    }
    const json = parseJsonSafe(body);
    walk(json, (record) => {
      const typename = String(record.__typename || "");
      const shortcode = String(record.code || "");
      if (!shortcode || !typename.startsWith("XIGPolaris")) {
        return;
      }
      if (typename.includes("Video") || Number(record.media_type) === 2) {
        return;
      }
      const slides = Array.isArray(record.carousel_media) && record.carousel_media.length > 0
        ? record.carousel_media
        : [record];
      let part = 0;
      for (const slide of slides) {
        const item = asRecord(slide) ?? record;
        if (Number(item.media_type) === 2) {
          continue;
        }
        const url = pickCandidateUrl(item);
        if (!url) {
          continue;
        }
        const key = `${shortcode}:${url}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        part += 1;
        images.push({
          part,
          url,
          shortcode,
          takenAt: Number(item.taken_at || record.taken_at || 0),
        });
      }
    });
  }
  return images;
}

function classifyHtml(status: number, html: string, username: string) {
  const title = htmlTitle(html);
  if (status === 404 || /page not found/i.test(title) || /page not found/i.test(html)) {
    throw new FeedError(`Instagram account not found: ${username}`, 404);
  }
  if (isAgeRestrictedText(html)) {
    throw new FeedError(
      `Instagram hid @${username} because the profile is age-restricted.`,
      400,
    );
  }
  if (/restricted profile/i.test(html)) {
    throw new FeedError(
      `Instagram hid @${username} because the profile is age-restricted.`,
      400,
    );
  }
}

function isAgeRestrictedText(text: string) {
  return (
    /restricted profile/i.test(text) ||
    /you must be \d+ years old/i.test(text) ||
    /years old or over to see this profile/i.test(text) ||
    /age[-\s]?restrict/i.test(text)
  );
}

function compactHeaders(headers: Record<string, string | undefined>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null || value === "") {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function createClient(cookieHeaderValue = "") {
  const cookies = parseCookieHeader(cookieHeaderValue);
  if (!cookies.has("csrftoken")) {
    cookies.set("csrftoken", randomBytes(16).toString("hex"));
  }

  const state = {
    cookies,
    wwwClaim: "0",
  };

  function request(url: string, headers: Record<string, string | undefined> = {}, redirectCount = 0) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("instagram.com")) {
      return Promise.reject(new FeedError("Could not load that Instagram profile.", 502));
    }

    return new Promise<{ status: number; contentType: string; text: string }>((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: parsed.hostname,
          path: `${parsed.pathname}${parsed.search}`,
          method: "GET",
          headers: compactHeaders({
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": USER_AGENT,
            Cookie: cookieHeader(state.cookies),
            ...headers,
          }),
        },
        (res) => {
          applySetCookie(state.cookies, res.headers["set-cookie"]);
          const claim = res.headers["x-ig-set-www-claim"];
          if (typeof claim === "string" && claim) {
            state.wwwClaim = claim;
          }
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const status = res.statusCode ?? 0;
            const location = res.headers.location;
            if (status >= 300 && status < 400 && location && redirectCount < MAX_REDIRECTS) {
              const next = new URL(location, url).toString();
              resolve(request(next, headers, redirectCount + 1));
              return;
            }
            resolve({
              status,
              contentType: String(res.headers["content-type"] || ""),
              text: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );
      req.on("error", () => {
        reject(new FeedError("Could not load that Instagram profile.", 502));
      });
      req.end();
    });
  }

  function apiHeaders(referer = `${IG_ORIGIN}/`) {
    return {
      Accept: "*/*",
      Origin: IG_ORIGIN,
      Referer: referer,
      "X-CSRFToken": state.cookies.get("csrftoken") || "",
      "X-IG-App-ID": IG_APP_ID,
      "X-ASBD-ID": "129477",
      "X-IG-WWW-Claim": state.wwwClaim,
      "X-Requested-With": "XMLHttpRequest",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    };
  }

  return {
    async profileHtml(username: string) {
      return request(`${IG_ORIGIN}/${encodeURIComponent(username)}/`, {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      });
    },
    async restFeedPage(userId: string, username: string, maxId?: string) {
      const params = new URLSearchParams({ count: "30" });
      if (maxId) {
        params.set("max_id", maxId);
      }
      const raw = await request(
        `${IG_ORIGIN}/api/v1/feed/user/${encodeURIComponent(userId)}/?${params}`,
        apiHeaders(`${IG_ORIGIN}/${encodeURIComponent(username)}/`),
      );
      if (raw.status === 429 || /please wait a few minutes/i.test(raw.text)) {
        throw new FeedError("Instagram rate-limited the request. Wait and try again.", 429);
      }
      if (raw.status === 401 || raw.status === 403) {
        throw new FeedError(
          "Could not load that Instagram profile. Add an Instagram cookie in Settings and try again, or upload images instead.",
          400,
        );
      }
      const json = parseJsonSafe(raw.text);
      const page = asRecord(json);
      if (!page || !Array.isArray(page.items)) {
        throw new FeedError("Could not load that Instagram profile.", 502);
      }
      return page;
    },
  };
}

function toFeedImages(
  images: Array<{ part: number; url: string; shortcode: string; takenAt: number }>,
) {
  return images.map((image) => ({
    url: image.url,
    name: `${datePrefix(image.takenAt)}_${image.shortcode}_${String(image.part).padStart(2, "0")}.jpg`,
  }));
}

export async function listInstagramFeedImages(
  username: string,
  count: number,
  cookieHeaderValue = "",
): Promise<FeedImage[]> {
  const client = createClient(cookieHeaderValue);
  const html = await client.profileHtml(username);
  classifyHtml(html.status, html.text, username);

  const user = parseUserFromHtml(html.text);
  if (!user) {
    throw new FeedError(
      "Could not load that Instagram profile. Add an Instagram cookie in Settings and try again, or upload images instead.",
      400,
    );
  }
  const handle = user.username || username;
  if (user.is_private && !user.followed_by_viewer) {
    throw new FeedError(`@${handle} is private.`, 400);
  }

  const collected: FeedImage[] = [];
  const userId = String(user.id || user.pk || "");
  if (userId) {
    try {
      let maxId: string | undefined;
      for (let page = 0; page < MAX_PAGES && collected.length < count; page += 1) {
        const feed = await client.restFeedPage(userId, handle, maxId);
        const items = Array.isArray(feed.items) ? feed.items : [];
        for (const item of items) {
          const record = asRecord(item);
          if (!record) {
            continue;
          }
          for (const image of imagesFromRestItem(record)) {
            collected.push(...toFeedImages([image]));
            if (collected.length >= count) {
              return collected.slice(0, count);
            }
          }
        }
        if (!feed.more_available || !feed.next_max_id) {
          break;
        }
        maxId = String(feed.next_max_id);
        await sleep(PAGE_DELAY_MS);
      }
    } catch (error) {
      if (error instanceof FeedError && error.status === 429) {
        throw error;
      }
      if (collected.length > 0) {
        return collected.slice(0, count);
      }
    }
  }

  if (collected.length < count) {
    const fromHtml = toFeedImages(imagesFromHtml(html.text));
    const seen = new Set(collected.map((image) => image.url));
    for (const image of fromHtml) {
      if (seen.has(image.url)) {
        continue;
      }
      collected.push(image);
      if (collected.length >= count) {
        break;
      }
    }
  }

  return collected.slice(0, count);
}
