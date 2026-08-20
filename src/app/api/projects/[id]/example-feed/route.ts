import { ExampleLimitError } from "@/lib/account/examples";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { FeedError } from "@/lib/feeds/errors";
import { importFeedExamples } from "@/lib/feeds/import";
import type { FeedPlatform } from "@/lib/feeds/types";

export const maxDuration = 60;
export const runtime = "nodejs";

function errorResponse(error: unknown): Response | null {
  if (error instanceof AuthRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ProjectNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ExampleLimitError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof FeedError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}

function parsePlatform(value: unknown): FeedPlatform | null {
  return value === "instagram" || value === "x" ? value : null;
}

const MAX_INSTAGRAM_COOKIE_CHARS = 16_384;

function parseInstagramCookie(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (typeof value !== "string") {
    throw new FeedError("Invalid Instagram cookie.");
  }
  const cookie = value.replace(/^Cookie:\s*/i, "").trim();
  if (cookie.length > MAX_INSTAGRAM_COOKIE_CHARS) {
    throw new FeedError("Instagram cookie is too large.");
  }
  if (cookie.includes("\n") || cookie.includes("\r")) {
    throw new FeedError("Invalid Instagram cookie.");
  }
  return cookie;
}

function parseCount(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return Number.NaN;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const source = typeof body.source === "string" ? body.source : "";
    const platform = parsePlatform(body.platform);
    const count = parseCount(body.count);
    const instagramCookie = parseInstagramCookie(body.instagramCookie);

    if (!source.trim()) {
      return Response.json(
        { error: "Enter an Instagram or X profile URL or @handle." },
        { status: 400 },
      );
    }
    if (!platform) {
      return Response.json({ error: "Choose Instagram or X." }, { status: 400 });
    }
    if (Number.isNaN(count)) {
      return Response.json({ error: "Image count must be a positive integer." }, { status: 400 });
    }

    const result = await importFeedExamples(user.id, id, {
      source,
      platform,
      count,
      instagramCookie: platform === "instagram" ? instagramCookie : "",
    });
    return Response.json(result);
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not pull images from that feed." }, { status: 500 })
    );
  }
}
