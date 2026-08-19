import { and, desc, eq } from "drizzle-orm";
import { getUserGeneration } from "@/lib/account/generation";
import { db } from "@/lib/db";
import { project } from "@/lib/db/schema";
import type {
  ProjectRecord,
  ProjectSnapshot,
  ProjectSummary,
  StoredExample,
} from "@/lib/generation/types";

export class ProjectNotFoundError extends Error {
  readonly status = 404 as const;

  constructor(message = "Project not found.") {
    super(message);
    this.name = "ProjectNotFoundError";
  }
}

export type ProjectListResult = {
  projects: ProjectSummary[];
  lastOpenedId: string;
};

export type ProjectPatch = Partial<ProjectSnapshot> & {
  name?: string;
  opened?: boolean;
};

type ProjectRow = typeof project.$inferSelect;

const EMPTY_SNAPSHOT: ProjectSnapshot = {
  prompt: "",
  modelId: "",
  analyzerId: "noop",
  analysisModelId: null,
  styleHint: "",
  images: [],
  examples: [],
  selectedIndex: null,
  updateText: "",
};

function toSummary(row: {
  id: string;
  name: string;
  updatedAt: Date | number;
}): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : row.updatedAt,
  };
}

function toRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    modelId: row.modelId,
    analyzerId: row.analyzerId,
    analysisModelId: row.analysisModelId,
    styleHint: row.styleHint,
    images: row.images,
    examples: row.examples,
    selectedIndex: row.selectedIndex,
    updateText: row.updateText,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    lastOpenedAt: row.lastOpenedAt.getTime(),
  };
}

function nextUntitledName(names: string[]): string {
  const used = new Set(names);
  if (!used.has("Untitled")) {
    return "Untitled";
  }

  let index = 2;
  while (used.has(`Untitled ${index}`)) {
    index += 1;
  }
  return `Untitled ${index}`;
}

function lastOpenedIdFrom(
  rows: Array<Pick<ProjectRow, "id" | "lastOpenedAt">>,
): string {
  const first = rows[0];
  if (!first) {
    throw new Error("No projects.");
  }

  let selected = first;
  for (const row of rows) {
    if (row.lastOpenedAt.getTime() > selected.lastOpenedAt.getTime()) {
      selected = row;
    }
  }
  return selected.id;
}

async function listProjectRows(userId: string) {
  return db
    .select({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      lastOpenedAt: project.lastOpenedAt,
    })
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt));
}

async function insertProject(
  userId: string,
  name: string,
  snapshot: ProjectSnapshot,
): Promise<ProjectRecord> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(project).values({
    id,
    userId,
    name,
    prompt: snapshot.prompt,
    modelId: snapshot.modelId,
    analyzerId: snapshot.analyzerId,
    analysisModelId: snapshot.analysisModelId,
    styleHint: snapshot.styleHint,
    images: snapshot.images,
    examples: snapshot.examples,
    selectedIndex: snapshot.selectedIndex,
    updateText: snapshot.updateText,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  });

  const created = await getOwnedProject(userId, id);
  if (!created) {
    throw new Error("Could not create project.");
  }
  return created;
}

async function getOwnedProject(
  userId: string,
  projectId: string,
): Promise<ProjectRecord | null> {
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);

  return row ? toRecord(row) : null;
}

export async function listProjects(userId: string): Promise<ProjectListResult> {
  let rows = await listProjectRows(userId);

  if (rows.length === 0) {
    const generation = await getUserGeneration(userId);
    if (generation) {
      await insertProject(userId, "Untitled", {
        prompt: generation.prompt,
        modelId: generation.modelId,
        analyzerId: generation.analyzerId,
        analysisModelId: generation.analysisModelId ?? null,
        styleHint: generation.styleHint,
        images: generation.images,
        examples: [],
        selectedIndex: null,
        updateText: "",
      });
    } else {
      await insertProject(userId, "Untitled", EMPTY_SNAPSHOT);
    }
    rows = await listProjectRows(userId);
  }

  return {
    projects: rows.map(toSummary),
    lastOpenedId: lastOpenedIdFrom(rows),
  };
}

export async function createProject(userId: string): Promise<ProjectRecord> {
  const rows = await listProjectRows(userId);
  const name = nextUntitledName(rows.map((row) => row.name));
  return insertProject(userId, name, EMPTY_SNAPSHOT);
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<ProjectRecord> {
  const record = await getOwnedProject(userId, projectId);
  if (!record) {
    throw new ProjectNotFoundError();
  }
  return record;
}

export async function patchProject(
  userId: string,
  projectId: string,
  patch: ProjectPatch,
): Promise<ProjectSummary> {
  const existing = await getOwnedProject(userId, projectId);
  if (!existing) {
    throw new ProjectNotFoundError();
  }

  const now = new Date();
  const updates: Partial<ProjectRow> = {};

  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (name.length === 0) {
      throw new Error("Project name is required.");
    }
    updates.name = name;
  }

  if (typeof patch.prompt === "string") {
    updates.prompt = patch.prompt;
  }
  if (typeof patch.modelId === "string") {
    updates.modelId = patch.modelId;
  }
  if (typeof patch.analyzerId === "string") {
    updates.analyzerId = patch.analyzerId;
  }
  if (patch.analysisModelId !== undefined) {
    updates.analysisModelId = patch.analysisModelId;
  }
  if (typeof patch.styleHint === "string") {
    updates.styleHint = patch.styleHint;
  }
  if (patch.images !== undefined) {
    updates.images = patch.images;
  }
  if (patch.examples !== undefined) {
    updates.examples = patch.examples;
  }
  if (patch.selectedIndex !== undefined) {
    updates.selectedIndex = patch.selectedIndex;
  }
  if (typeof patch.updateText === "string") {
    updates.updateText = patch.updateText;
  }

  const snapshotChanged = Object.keys(updates).length > 0;
  if (snapshotChanged) {
    updates.updatedAt = now;
  }
  if (patch.opened) {
    updates.lastOpenedAt = now;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(project)
      .set(updates)
      .where(and(eq(project.id, projectId), eq(project.userId, userId)));
  }

  const updated = await getOwnedProject(userId, projectId);
  if (!updated) {
    throw new ProjectNotFoundError();
  }
  return toSummary(updated);
}

export async function saveGenerationToProject(
  userId: string,
  projectId: string,
  record: {
    prompt: string;
    modelId: string;
    analyzerId: string;
    analysisModelId?: string;
    styleHint: string;
    images: string[];
  },
): Promise<void> {
  await patchProject(userId, projectId, {
    prompt: record.prompt,
    modelId: record.modelId,
    analyzerId: record.analyzerId,
    analysisModelId: record.analysisModelId ?? null,
    styleHint: record.styleHint,
    images: record.images,
  });
}

export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<ProjectListResult & { replacement: ProjectRecord | null }> {
  const existing = await getOwnedProject(userId, projectId);
  if (!existing) {
    throw new ProjectNotFoundError();
  }

  await db
    .delete(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)));

  let rows = await listProjectRows(userId);
  let replacement: ProjectRecord | null = null;

  if (rows.length === 0) {
    replacement = await insertProject(userId, "Untitled", EMPTY_SNAPSHOT);
    rows = await listProjectRows(userId);
  }

  return {
    projects: rows.map(toSummary),
    lastOpenedId: lastOpenedIdFrom(rows),
    replacement,
  };
}

export function parseStoredExamples(value: unknown): StoredExample[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const examples: StoredExample[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string") {
      return null;
    }
    if (record.kind === "bundled") {
      continue;
    }
    if (record.kind !== "upload") {
      return null;
    }
    if (typeof record.previewUrl !== "string") {
      return null;
    }
    if (record.previewUrl.startsWith("/examples/")) {
      continue;
    }
    examples.push({
      id: record.id,
      name: record.name,
      kind: "upload",
      previewUrl: record.previewUrl,
    });
  }
  return examples;
}

export function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return null;
  }
  return value;
}
