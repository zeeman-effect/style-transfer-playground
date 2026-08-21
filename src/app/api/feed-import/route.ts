import { ExampleLimitError } from "@/lib/account/examples";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { FeedError } from "@/lib/feeds/errors";
import {
  claimFeedImportToken,
  completeFeedImportToken,
  discardFeedImportToken,
  failFeedImportToken,
  readFeedImportToken,
} from "@/lib/feeds/import-token";
import { importFeedExamples } from "@/lib/feeds/import";
import {
  INSTAGRAM_SHORTCODE_RE,
  isInstagramCdnUrl,
} from "@/lib/feeds/instagram";
import { MAX_FEED_IMPORT } from "@/lib/images/constants";

export const maxDuration = 60;
export const runtime = "nodejs";

function parseStringList(
  value: unknown,
  label: string,
  keep: (entry: string) => boolean,
): string[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new FeedError(`Invalid Instagram ${label}.`);
  }
  if (value.length > MAX_FEED_IMPORT) {
    throw new FeedError(`Too many Instagram ${label}.`);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || !keep(entry)) {
      throw new FeedError(`Invalid Instagram ${label}.`);
    }
    if (seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

/**
 * Called by the relay tab. Instagram's CSP blocks a request to this origin from
 * the profile page itself, so the snippet opens the relay instead and the relay
 * makes this same-origin call. The single-use token is what authorizes it.
 */
export async function POST(request: Request) {
  let token = "";
  let projectId: string | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    token = typeof body.token === "string" ? body.token : "";
    const urls = parseStringList(body.urls, "images", isInstagramCdnUrl);
    const codes = parseStringList(body.codes, "posts", (entry) =>
      INSTAGRAM_SHORTCODE_RE.test(entry),
    );

    const claim = await claimFeedImportToken(token);
    if (!claim) {
      return Response.json(
        { error: "This import is no longer authorized. Press Pull again." },
        { status: 401 },
      );
    }
    projectId = claim.projectId;
    if (urls.length === 0) {
      await failFeedImportToken(token, "No usable images were found.");
      return Response.json(
        { error: "No usable images were found.", projectId },
        { status: 400 },
      );
    }

    const result = await importFeedExamples(claim.userId, claim.projectId, {
      source: claim.source,
      platform: "instagram",
      count: claim.count,
      instagramShortcodes: codes,
      instagramImageUrls: urls,
    });
    await completeFeedImportToken(token, result.examples);
    return Response.json({
      ok: true,
      imported: result.examples.length,
      projectId,
    });
  } catch (error) {
    const message =
      error instanceof FeedError ||
      error instanceof ExampleLimitError ||
      error instanceof ProjectNotFoundError
        ? error.message
        : "Could not import those images.";
    if (token) {
      await failFeedImportToken(token, message);
    }
    const status = error instanceof FeedError ? error.status : 500;
    return Response.json({ error: message, projectId }, { status });
  }
}

/** The app tab polls this to notice an import that finished on another tab. */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const record = await readFeedImportToken(token, user.id);
    if (!record) {
      return Response.json({ status: "unknown" });
    }
    return Response.json({
      status: record.status,
      projectId: record.projectId,
      examples: record.examples,
      error: record.error,
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Could not check the import." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const token = new URL(request.url).searchParams.get("token") ?? "";
    await discardFeedImportToken(token, user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Could not cancel the import." }, { status: 500 });
  }
}
