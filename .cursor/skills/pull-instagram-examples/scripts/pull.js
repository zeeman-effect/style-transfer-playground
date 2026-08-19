#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const IG_APP_ID = "936619743392459";
const IG_ORIGIN = "https://www.instagram.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GRAPHQL_USER_FEED = "69cba40317214236af40e7efa697781d";
const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;
const PROFILE_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?/i;

class ScriptError extends Error {
  constructor(message, code, reason = "") {
    super(message);
    this.code = code;
    this.reason = reason;
  }
}

function fail(message, code, reason) {
  throw new ScriptError(message, code, reason);
}

const COOKIE_SETUP = `How to get INSTAGRAM_COOKIE:

1. In a browser, open Instagram while logged in (any page is fine).
2. Press F12 to open DevTools, then open the Network tab.
3. Filter to Doc / Document (not Fetch/XHR).
4. Reload the page.
5. Click the first document request. Its name is instagram.com only on the
   homepage; on a profile or other page it is named after that page instead.
6. Open Headers → Request Headers and copy the entire Cookie value.

Rerun from the workspace root:

  INSTAGRAM_COOKIE='paste-the-Cookie-header-here' node .cursor/skills/pull-instagram-examples/scripts/pull.js ACCOUNT COUNT ORDER

Treat that string like a password. Do not paste it into chat. Do not paste an Instagram password.`;

function loginHelp(reason = "Instagram required a valid login.") {
  return `${reason}\n\n${COOKIE_SETUP}`;
}

function looksLikeJson(contentType, text) {
  if ((contentType || "").includes("application/json")) return true;
  const trimmed = String(text || "").trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function htmlTitle(text) {
  const match = String(text || "").match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

function isAgeRestrictedText(text) {
  const body = String(text || "");
  return (
    /restricted profile/i.test(body) ||
    /you must be \d+ years old/i.test(body) ||
    /years old or over to see this profile/i.test(body) ||
    /sensitive content/i.test(body) ||
    /age[-\s]?restrict/i.test(body)
  );
}

function isPageNotFoundHtml(status, contentType, text) {
  if (status !== 404) return false;
  const title = htmlTitle(text);
  if (/page not found/i.test(title) || /page not found/i.test(text)) return true;
  return (contentType || "").includes("text/html");
}

/**
 * Classify an Instagram profile API/HTML payload.
 * missing accounts: HTTP 404 (often HTML titled "Page Not Found")
 * age-restricted: HTTP 200 JSON with data.user === null, or age-gate copy
 * login required: login_required / 401 / 403 / login HTML (not a 404 page)
 */
function classifyIgPayload({ status, contentType, text, json }, { username } = {}) {
  const body = String(text || "");
  const payload = json || parseJsonSafe(body);
  const html =
    (contentType || "").includes("text/html") ||
    body.trimStart().startsWith("<");

  if (body.includes("SecFetch Policy violation")) {
    return {
      kind: "client",
      message: "Instagram rejected the request (SecFetch Policy violation).",
    };
  }

  if (status === 429 || /please wait a few minutes/i.test(body)) {
    return { kind: "rate_limit", message: "Instagram rate-limited the request." };
  }

  if (isAgeRestrictedText(body)) {
    return { kind: "age_gated" };
  }

  if (isPageNotFoundHtml(status, contentType, body)) {
    return { kind: "not_found" };
  }

  if (payload && typeof payload === "object") {
    if (payload.require_login || payload.message === "login_required") {
      return { kind: "login" };
    }
    if (
      payload.data &&
      Object.prototype.hasOwnProperty.call(payload.data, "user")
    ) {
      if (payload.data.user == null) {
        return status === 404 ? { kind: "not_found" } : { kind: "age_gated" };
      }
      return { kind: "ok", user: payload.data.user };
    }
    if (payload.status === "fail") {
      const message = String(payload.message || "request failed");
      if (/login/i.test(message)) return { kind: "login" };
      if (/user not found|does not exist/i.test(message)) {
        return { kind: "not_found" };
      }
      if (status === 401 || status === 403) return { kind: "login" };
      return { kind: "api_fail", message };
    }
  }

  if (status === 401 || status === 403) return { kind: "login" };

  if (html) {
    const title = htmlTitle(body);
    if (username && new RegExp(`@${username}\\b`, "i").test(title)) {
      return { kind: "exists_html" };
    }
    if (/profilepage_/i.test(body)) return { kind: "exists_html" };
    if (/page not found/i.test(title) || /page not found/i.test(body)) {
      return { kind: "not_found" };
    }
    return { kind: "login" };
  }

  if (status === 404) return { kind: "not_found" };
  return { kind: "fail", message: `Instagram request failed (HTTP ${status}).` };
}

function failForKind(kind, username, extraMessage) {
  if (kind === "not_found") {
    fail(`Instagram account not found: ${username}`, 3, "not_found");
  }
  if (kind === "age_gated") {
    fail(
      loginHelp(
        `Instagram hid @${username} because the profile is age-restricted. Log in with an account that meets Instagram's age requirement, then retry with INSTAGRAM_COOKIE.`,
      ),
      2,
      "age_gated",
    );
  }
  if (kind === "login") {
    fail(loginHelp(), 2, "login");
  }
  if (kind === "rate_limit") {
    fail("Instagram rate-limited the request. Wait and try again.", 4, "rate_limit");
  }
  fail(extraMessage || `Could not load Instagram account: ${username}`, 4, kind);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let destRoot = "examples";
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      console.log(
        "Usage: node pull.js <account> <count> <newest|oldest> [--dest-root examples]",
      );
      process.exit(0);
    }
    if (arg === "--dest-root") {
      destRoot = args[i + 1];
      if (!destRoot) fail("Missing value for --dest-root", 1);
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  if (positional.length !== 3) {
    fail(
      "Usage: node pull.js <account> <count> <newest|oldest> [--dest-root examples]",
      1,
    );
  }

  const [accountRaw, countRaw, orderRaw] = positional;
  const count = Number.parseInt(countRaw, 10);
  if (!Number.isInteger(count) || count <= 0) {
    fail("count must be a positive integer (number of images).", 1);
  }
  const order = String(orderRaw).toLowerCase();
  if (order !== "newest" && order !== "oldest") {
    fail('order must be "newest" or "oldest".', 1);
  }

  return { account: normalizeAccount(accountRaw), count, order, destRoot };
}

function normalizeAccount(raw) {
  let value = String(raw).trim();
  const match = PROFILE_URL_RE.exec(value);
  if (match) value = match[1];
  value = value.replace(/^@/, "");
  if (["p", "reel", "reels", "stories", "tv"].includes(value.toLowerCase())) {
    fail(`Could not parse an Instagram username from: ${raw}`, 1);
  }
  if (!USERNAME_RE.test(value)) {
    fail(`Invalid Instagram username: ${raw}`, 1);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCookieHeader(header) {
  const map = new Map();
  if (!header) return map;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return map;
}

function cookieHeader(map) {
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function applySetCookie(map, headers) {
  const setter =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie")]
        : [];
  for (const line of setter) {
    const pair = String(line).split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function extFromContentType(type) {
  if (!type) return "";
  const subtype = type.split(";")[0].split("/")[1];
  if (!subtype) return "";
  if (subtype === "jpeg") return ".jpg";
  if (["jpg", "png", "webp"].includes(subtype)) return `.${subtype}`;
  return "";
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.(jpg|jpeg|png|webp)$/);
    if (!match) return ".jpg";
    return match[1] === "jpeg" ? ".jpg" : `.${match[1]}`;
  } catch {
    return ".jpg";
  }
}

function datePrefix(unixSeconds) {
  const date = new Date(Number(unixSeconds || 0) * 1000);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) {
    return "00000000";
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function pickCandidateUrl(item) {
  const candidates = item?.image_versions2?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const best = [...candidates].sort(
    (a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0),
  )[0];
  return best?.url || null;
}

function isVideoRest(item) {
  return Number(item?.media_type) === 2 || Boolean(item?.video_versions);
}

function imagesFromRestItem(item) {
  const shortcode = item.code || item.pk;
  const takenAt = item.taken_at || item.device_timestamp || 0;
  const slides = Array.isArray(item.carousel_media)
    ? item.carousel_media
    : [item];
  const images = [];
  let part = 0;
  for (const slide of slides) {
    if (isVideoRest(slide) && !pickCandidateUrl(slide)) continue;
    if (Number(slide.media_type) === 2) continue;
    const url = pickCandidateUrl(slide);
    if (!url) continue;
    part += 1;
    images.push({ part, url, shortcode, takenAt });
  }
  return images;
}

function imagesFromGraphqlNode(node) {
  const shortcode = node.shortcode || node.id;
  const takenAt = node.taken_at_timestamp || 0;
  const children = node.edge_sidecar_to_children?.edges;
  if (Array.isArray(children) && children.length > 0) {
    const images = [];
    let part = 0;
    for (const edge of children) {
      const child = edge.node || {};
      if (child.is_video) continue;
      if (!child.display_url) continue;
      part += 1;
      images.push({
        part,
        url: child.display_url,
        shortcode,
        takenAt,
      });
    }
    return images;
  }
  if (node.is_video) return [];
  if (!node.display_url) return [];
  return [{ part: 1, url: node.display_url, shortcode, takenAt }];
}

function compactHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

function createClient() {
  const cookies = parseCookieHeader(process.env.INSTAGRAM_COOKIE || "");
  if (process.env.INSTAGRAM_SESSIONID && !cookies.has("sessionid")) {
    cookies.set("sessionid", process.env.INSTAGRAM_SESSIONID);
  }
  if (!cookies.has("csrftoken")) {
    cookies.set("csrftoken", crypto.randomBytes(16).toString("hex"));
  }

  const state = {
    cookies,
    wwwClaim: "0",
  };

  async function request(url, { method = "GET", headers = {}, body } = {}) {
    const res = await fetch(url, {
      method,
      body,
      redirect: "follow",
      headers: compactHeaders({
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": USER_AGENT,
        Origin: IG_ORIGIN,
        Referer: `${IG_ORIGIN}/`,
        "X-CSRFToken": state.cookies.get("csrftoken") || "",
        "X-IG-App-ID": IG_APP_ID,
        "X-ASBD-ID": "129477",
        "X-IG-WWW-Claim": state.wwwClaim,
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        Cookie: cookieHeader(state.cookies),
        ...headers,
      }),
    });

    applySetCookie(state.cookies, res.headers);
    const claim = res.headers.get("x-ig-set-www-claim");
    if (claim) state.wwwClaim = claim;
    return res;
  }

  async function requestRaw(url, options = {}, attempt = 1) {
    const res = await request(url, options);
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    if (res.status === 429 || /please wait a few minutes/i.test(text)) {
      if (attempt < 4) {
        const waitMs = attempt * 8000;
        console.error(`Rate limited; retrying in ${waitMs / 1000}s...`);
        await sleep(waitMs);
        return requestRaw(url, options, attempt + 1);
      }
    }
    return {
      status: res.status,
      contentType,
      text,
      json: looksLikeJson(contentType, text) ? parseJsonSafe(text) : null,
    };
  }

  async function requestJson(url, options = {}) {
    const raw = await requestRaw(url, options);
    const classified = classifyIgPayload(raw);
    if (classified.kind === "ok") return raw.json;
    if (classified.kind === "login") fail(loginHelp(), 2, "login");
    if (classified.kind === "age_gated") {
      fail(loginHelp("Instagram hid this content because it is age-restricted."), 2, "age_gated");
    }
    if (classified.kind === "not_found") {
      fail("Instagram returned 404 Not Found.", 3, "not_found");
    }
    if (classified.kind === "rate_limit") {
      fail("Instagram rate-limited the request. Wait and try again.", 4, "rate_limit");
    }
    if (classified.kind === "api_fail") {
      fail(`Instagram request failed: ${classified.message}`, 4, "api_fail");
    }
    if (raw.json && raw.json.status !== "fail" && resOkish(raw)) {
      return raw.json;
    }
    fail(classified.message || `Instagram request failed (HTTP ${raw.status}).`, 4, classified.kind);
  }

  function resOkish(raw) {
    return raw.status >= 200 && raw.status < 300;
  }

  async function profileHtml(username) {
    return requestRaw(`${IG_ORIGIN}/${encodeURIComponent(username)}/`, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "X-Requested-With": undefined,
      },
    });
  }

  return {
    async warmup(username) {
      try {
        await profileHtml(username);
      } catch {
        // Best-effort cookie bootstrap.
      }
    },
    async profile(username) {
      const api = await requestRaw(
        `${IG_ORIGIN}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      );
      const classified = classifyIgPayload(api, { username });
      if (classified.kind === "ok") return classified.user;
      if (
        classified.kind === "not_found" ||
        classified.kind === "age_gated" ||
        classified.kind === "login" ||
        classified.kind === "rate_limit"
      ) {
        failForKind(classified.kind, username, classified.message);
      }

      const html = await profileHtml(username);
      const htmlClass = classifyIgPayload(html, { username });
      if (htmlClass.kind === "ok") return htmlClass.user;
      if (htmlClass.kind === "exists_html") {
        fail(
          loginHelp(
            `Instagram account @${username} exists, but the profile API failed: ${classified.message || "unknown error"}. Retry with INSTAGRAM_COOKIE.`,
          ),
          2,
          "login",
        );
      }
      failForKind(
        htmlClass.kind,
        username,
        htmlClass.message || classified.message,
      );
    },
    async restFeedPage(userId, maxId) {
      const params = new URLSearchParams({ count: "30" });
      if (maxId) params.set("max_id", maxId);
      return requestJson(`${IG_ORIGIN}/api/v1/feed/user/${userId}/?${params}`);
    },
    async graphqlFeedPage(userId, after) {
      const variables = { id: String(userId), first: 24 };
      if (after) variables.after = after;
      const params = new URLSearchParams({
        query_hash: GRAPHQL_USER_FEED,
        variables: JSON.stringify(variables),
      });
      const data = await requestJson(`${IG_ORIGIN}/graphql/query/?${params}`);
      return data?.data?.user?.edge_owner_to_timeline_media || null;
    },
    async mediaInfo(id) {
      const data = await requestJson(`${IG_ORIGIN}/api/v1/media/${id}/info/`);
      return data?.items?.[0] || null;
    },
    async download(url, destStem) {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "User-Agent": USER_AGENT,
          Referer: `${IG_ORIGIN}/`,
        },
      });
      if (!res.ok) {
        fail(`Failed downloading image (HTTP ${res.status}).`, 4);
      }
      const ext =
        extFromContentType(res.headers.get("content-type")) || extFromUrl(url);
      const dest = `${destStem}${ext}`;
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return dest;
    },
  };
}

async function* iteratePosts(client, user) {
  const userId = user.id || user.pk;
  const seen = new Set();
  let useGraphql = false;

  try {
    let maxId;
    while (true) {
      const page = await client.restFeedPage(userId, maxId);
      const items = page.items || [];
      if (items.length === 0 && !maxId) {
        useGraphql = true;
        break;
      }
      for (const item of items) {
        const id = String(item.pk || item.id);
        if (seen.has(id)) continue;
        seen.add(id);
        yield { source: "rest", item };
      }
      if (!page.more_available || !page.next_max_id) return;
      maxId = page.next_max_id;
      await sleep(2000);
    }
  } catch (error) {
    if (!(error instanceof ScriptError) || error.code !== 2) throw error;
    useGraphql = true;
    console.error("REST feed needs login; trying GraphQL pagination...");
  }

  if (!useGraphql) return;

  let media = user.edge_owner_to_timeline_media;
  while (media?.edges) {
    for (const edge of media.edges) {
      const node = edge.node;
      const id = String(node.id || node.shortcode);
      if (seen.has(id)) continue;
      seen.add(id);
      yield { source: "graphql", item: node };
    }
    if (!media.page_info?.has_next_page) return;
    await sleep(2000);
    media = await client.graphqlFeedPage(userId, media.page_info.end_cursor);
    if (!media) fail(loginHelp(), 2);
  }
}

async function expandImages(client, entry) {
  if (entry.source === "rest") return imagesFromRestItem(entry.item);

  const node = entry.item;
  let images = imagesFromGraphqlNode(node);
  const needsSidecar =
    (node.__typename === "GraphSidecar" || node.edge_sidecar_to_children) &&
    images.length <= 1;
  if (needsSidecar && node.id) {
    try {
      const rest = await client.mediaInfo(node.id);
      if (rest) images = imagesFromRestItem(rest);
    } catch {
      // Keep the GraphQL image(s) we already have.
    }
  }
  return images;
}

async function collectPosts(client, user, order, neededImages) {
  const posts = [];
  let imageCount = 0;
  for await (const entry of iteratePosts(client, user)) {
    posts.push(entry);
    if (order === "newest") {
      const images = await expandImages(client, entry);
      imageCount += images.length;
      entry.images = images;
      if (imageCount >= neededImages) break;
    }
  }
  if (order === "oldest") posts.reverse();
  return posts;
}

async function alreadyDownloaded(outDir, stem) {
  const entries = await fs.readdir(outDir).catch(() => []);
  return entries.find((name) => name.startsWith(`${stem}.`) || name === stem);
}

async function main() {
  if (typeof fetch !== "function") {
    fail("This script needs Node.js 18+ (built-in fetch).", 1);
  }

  const { account, count, order, destRoot } = parseArgs(process.argv);
  const client = createClient();
  await client.warmup(account);
  const user = await client.profile(account);

  if (user.is_private && !user.followed_by_viewer) {
    fail(
      loginHelp(
        `@${user.username} is private. Log in with an account that follows it, then retry with INSTAGRAM_COOKIE.`,
      ),
      2,
      "private",
    );
  }

  const outDir = path.join(destRoot, user.username);
  await fs.mkdir(outDir, { recursive: true });

  if (order === "oldest") {
    console.error(
      "Collecting posts to start from the oldest (walks the full profile)...",
    );
  }

  const posts = await collectPosts(client, user, order, count);
  let downloaded = 0;
  let alreadyPresent = 0;
  let skippedVideos = 0;
  let considered = 0;

  for (const entry of posts) {
    const images = entry.images || (await expandImages(client, entry));
    if (images.length === 0) {
      skippedVideos += 1;
      continue;
    }
    for (const image of images) {
      if (considered >= count) break;
      considered += 1;
      const stem = `${datePrefix(image.takenAt)}_${image.shortcode}_${String(image.part).padStart(2, "0")}`;
      const existing = await alreadyDownloaded(outDir, stem);
      if (existing) {
        alreadyPresent += 1;
        console.log(`[${considered}/${count}] exists ${existing}`);
        continue;
      }
      const saved = await client.download(image.url, path.join(outDir, stem));
      downloaded += 1;
      console.log(`[${considered}/${count}] saved ${path.basename(saved)}`);
    }
    if (considered >= count) break;
  }

  const destDisplay = outDir.split(path.sep).join("/");
  console.log("");
  console.log(`Account: @${user.username}`);
  console.log(`Destination: ${destDisplay}`);
  console.log(`Order: ${order}`);
  console.log(`Requested: ${count}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Already present: ${alreadyPresent}`);
  console.log(`Skipped video-only posts: ${skippedVideos}`);
  if (considered < count) {
    console.log(
      `Stopped early: profile only had ${considered} image(s) in this range.`,
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    if (error instanceof ScriptError) {
      console.error(error.message);
      process.exit(error.code);
    }
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  COOKIE_SETUP,
  classifyIgPayload,
  loginHelp,
};
