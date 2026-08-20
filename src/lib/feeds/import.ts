import {
  countProjectExamples,
  createProjectExample,
} from "@/lib/account/examples";
import { ExampleLimitError } from "@/lib/account/errors";
import { getProject } from "@/lib/account/projects";
import { downloadFeedImage } from "@/lib/feeds/download";
import { FeedError } from "@/lib/feeds/errors";
import { listInstagramFeedImages } from "@/lib/feeds/instagram";
import { parseFeedSource } from "@/lib/feeds/parse";
import type { FeedPlatform } from "@/lib/feeds/types";
import { listXFeedImages } from "@/lib/feeds/x";
import type { StoredExample } from "@/lib/generation/types";
import {
  DEFAULT_FEED_IMPORT,
  MAX_FEED_IMPORT,
  MAX_PROJECT_EXAMPLES,
  MIN_FEED_IMPORT,
} from "@/lib/images/constants";

export type ImportFeedInput = {
  source: string;
  platform: FeedPlatform;
  count?: number;
  instagramCookie?: string;
};

export type ImportFeedResult = {
  examples: StoredExample[];
};

function resolveCount(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_FEED_IMPORT;
  }
  if (!Number.isInteger(value) || value < MIN_FEED_IMPORT) {
    throw new FeedError("Image count must be a positive integer.");
  }
  return Math.min(value, MAX_FEED_IMPORT);
}

export async function importFeedExamples(
  userId: string,
  projectId: string,
  input: ImportFeedInput,
): Promise<ImportFeedResult> {
  await getProject(userId, projectId);
  const parsed = parseFeedSource(input.source, input.platform);
  const requested = resolveCount(input.count);
  const existing = await countProjectExamples(userId, projectId);
  const remaining = MAX_PROJECT_EXAMPLES - existing;
  if (remaining <= 0) {
    throw new ExampleLimitError();
  }
  const take = Math.min(requested, remaining);

  const refs =
    parsed.platform === "instagram"
      ? await listInstagramFeedImages(
          parsed.username,
          take,
          input.instagramCookie ?? "",
        )
      : await listXFeedImages(parsed.username, take);

  if (refs.length === 0) {
    throw new FeedError("No images found on that feed.", 400);
  }

  const examples: StoredExample[] = [];
  let lastError: unknown;

  for (const ref of refs.slice(0, take)) {
    try {
      const file = await downloadFeedImage(ref);
      examples.push(await createProjectExample(userId, projectId, file));
    } catch (error) {
      if (error instanceof ExampleLimitError) {
        break;
      }
      lastError = error;
    }
  }

  if (examples.length === 0) {
    if (lastError instanceof FeedError || lastError instanceof ExampleLimitError) {
      throw lastError;
    }
    throw new FeedError("Could not download images from that feed.", 502);
  }

  return { examples };
}
