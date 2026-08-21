import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedImportToken } from "@/lib/db/schema";
import type { StoredExample } from "@/lib/generation/types";

/** How long a Pull press stays valid as authorization for one import. */
export const FEED_IMPORT_TOKEN_TTL_MS = 15 * 60 * 1000;

export const FEED_IMPORT_TOKEN_RE = /^[a-f0-9]{64}$/;

export type FeedImportTokenStatus = "pending" | "done" | "error";

export type FeedImportTokenRecord = {
  token: string;
  userId: string;
  projectId: string;
  source: string;
  count: number;
  status: FeedImportTokenStatus;
  examples: StoredExample[];
  error: string | null;
};

function toRecord(row: typeof feedImportToken.$inferSelect): FeedImportTokenRecord {
  return {
    token: row.token,
    userId: row.userId,
    projectId: row.projectId,
    source: row.source,
    count: row.count,
    status: row.status,
    examples: row.examples ?? [],
    error: row.error,
  };
}

async function deleteExpired() {
  try {
    await db
      .delete(feedImportToken)
      .where(lt(feedImportToken.expiresAt, new Date(Date.now())));
  } catch {
    // Housekeeping only; never fail an import because cleanup did.
  }
}

export async function createFeedImportToken(input: {
  userId: string;
  projectId: string;
  source: string;
  count: number;
}): Promise<string> {
  await deleteExpired();
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await db.insert(feedImportToken).values({
    token,
    userId: input.userId,
    projectId: input.projectId,
    source: input.source,
    count: input.count,
    status: "pending",
    examples: null,
    error: null,
    claimedAt: null,
    completedAt: null,
    createdAt: new Date(now),
    expiresAt: new Date(now + FEED_IMPORT_TOKEN_TTL_MS),
  });
  return token;
}

/**
 * Marks the token as in-flight and returns it, or null when it is unknown,
 * expired, or already used. The claim is conditional on the row still being
 * unclaimed so two pastes of the same snippet cannot both import.
 */
export async function claimFeedImportToken(
  token: string,
): Promise<FeedImportTokenRecord | null> {
  if (!FEED_IMPORT_TOKEN_RE.test(token)) {
    return null;
  }
  const rows = await db
    .update(feedImportToken)
    .set({ claimedAt: new Date(Date.now()) })
    .where(
      and(
        eq(feedImportToken.token, token),
        eq(feedImportToken.status, "pending"),
        isNull(feedImportToken.claimedAt),
      ),
    )
    .returning();
  const row = rows[0];
  if (!row) {
    return null;
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return toRecord(row);
}

export async function completeFeedImportToken(
  token: string,
  examples: StoredExample[],
) {
  await db
    .update(feedImportToken)
    .set({
      status: "done",
      examples,
      error: null,
      completedAt: new Date(Date.now()),
    })
    .where(eq(feedImportToken.token, token));
}

export async function failFeedImportToken(token: string, error: string) {
  await db
    .update(feedImportToken)
    .set({
      status: "error",
      error,
      claimedAt: null,
      completedAt: new Date(Date.now()),
    })
    .where(eq(feedImportToken.token, token));
}

export async function readFeedImportToken(
  token: string,
  userId: string,
): Promise<FeedImportTokenRecord | null> {
  if (!FEED_IMPORT_TOKEN_RE.test(token)) {
    return null;
  }
  const rows = await db
    .select()
    .from(feedImportToken)
    .where(
      and(eq(feedImportToken.token, token), eq(feedImportToken.userId, userId)),
    )
    .limit(1);
  const row = rows[0];
  return row ? toRecord(row) : null;
}

export async function discardFeedImportToken(token: string, userId: string) {
  if (!FEED_IMPORT_TOKEN_RE.test(token)) {
    return;
  }
  await db
    .delete(feedImportToken)
    .where(
      and(eq(feedImportToken.token, token), eq(feedImportToken.userId, userId)),
    );
}
