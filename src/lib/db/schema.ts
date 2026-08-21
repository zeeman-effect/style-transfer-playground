import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { ProviderId, StoredExample } from "@/lib/generation/types";

export type StoredGenerationRunCall = {
  seq: number;
  kind:
    | "imageToText"
    | "textToText"
    | "textToImage"
    | "imageAndTextToImage";
  provider?: ProviderId;
  modelId: string;
  prompt: string;
  latencyMs: number;
  error?: string;
};

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("account_issuer_accountId_uidx").on(
      table.issuer,
      table.accountId,
    ),
    index("account_userId_idx").on(table.userId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userProviderKey = sqliteTable(
  "user_provider_key",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.provider] }),
    index("user_provider_key_userId_idx").on(table.userId),
  ],
);

export const userGeneration = sqliteTable("user_generation", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  modelId: text("model_id").notNull(),
  analyzerId: text("analyzer_id").notNull(),
  analysisModelId: text("analysis_model_id"),
  styleHint: text("style_hint").notNull(),
  images: text("images_json", { mode: "json" }).$type<string[]>().notNull(),
  savedAt: integer("saved_at", { mode: "timestamp_ms" }).notNull(),
});

export const project = sqliteTable(
  "project",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    modelId: text("model_id").notNull(),
    analyzerId: text("analyzer_id").notNull(),
    analysisModelId: text("analysis_model_id"),
    styleHint: text("style_hint").notNull(),
    images: text("images_json", { mode: "json" }).$type<string[]>().notNull(),
    examples: text("examples_json", { mode: "json" })
      .$type<StoredExample[]>()
      .notNull(),
    selectedIndex: integer("selected_index"),
    updateText: text("update_text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    lastOpenedAt: integer("last_opened_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("project_userId_idx").on(table.userId)],
);

export const projectExample = sqliteTable(
  "project_example",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    payload: blob("payload", { mode: "buffer" }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("project_example_projectId_sortOrder_idx").on(
      table.projectId,
      table.sortOrder,
    ),
  ],
);

/**
 * Instagram blocks datacenter IPs, so the import runs in the user's browser.
 * Instagram's CSP blocks posting to this origin, so a same-origin relay page
 * receives the image URLs. That request has no session cookies from the
 * Instagram tab, so a single-use token issued by Pull authorizes it, and the
 * app tab polls the same row for the result.
 */
export const feedImportToken = sqliteTable(
  "feed_import_token",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    source: text("source").notNull(),
    count: integer("count").notNull(),
    status: text("status").$type<"pending" | "done" | "error">().notNull(),
    examples: text("examples_json", { mode: "json" }).$type<StoredExample[]>(),
    error: text("error"),
    claimedAt: integer("claimed_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("feed_import_token_userId_idx").on(table.userId),
    index("feed_import_token_expiresAt_idx").on(table.expiresAt),
  ],
);

export const generationRun = sqliteTable(
  "generation_run",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id"),
    prompt: text("prompt").notNull(),
    modelId: text("model_id").notNull(),
    analyzerId: text("analyzer_id").notNull(),
    analysisModelId: text("analysis_model_id"),
    exampleCount: integer("example_count").notNull(),
    hasSourceImage: integer("has_source_image", { mode: "boolean" }).notNull(),
    styleHint: text("style_hint"),
    success: integer("success", { mode: "boolean" }).notNull(),
    error: text("error"),
    durationMs: integer("duration_ms").notNull(),
    configuredProviders: text("configured_providers", { mode: "json" })
      .$type<Record<ProviderId, boolean>>()
      .notNull(),
    calls: text("calls", { mode: "json" })
      .$type<StoredGenerationRunCall[]>()
      .notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("generation_run_userId_idx").on(table.userId),
    index("generation_run_startedAt_idx").on(table.startedAt),
  ],
);
