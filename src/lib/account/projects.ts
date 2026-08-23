import { and, desc, eq } from "drizzle-orm";
import {
  countProjectExamples,
  deleteProjectExamples,
  insertLegacyExample,
  listProjectExampleMeta,
} from "@/lib/account/examples";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { getUserGeneration } from "@/lib/account/generation";
import {
  backfillLegacyGeneration,
  countProjectGenerations,
  createProjectGeneration,
  deleteProjectGenerations,
  listProjectGenerations,
  parseDataUrl,
} from "@/lib/account/generations";
import { db } from "@/lib/db";
import { project } from "@/lib/db/schema";
import { MAX_PROJECT_EXAMPLES } from "@/lib/images/constants";
import type {
  ProjectGeneration,
  ProjectRecord,
  ProjectSnapshot,
  ProjectSummary,
  StoredExample,
} from "@/lib/generation/types";

export { ProjectNotFoundError };

export type ProjectListResult = {
  projects: ProjectSummary[];
  lastOpenedId: string;
};

export type ProjectPatch = Partial<
  Omit<ProjectSnapshot, "examples" | "generations">
> & {
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
  generations: [],
  examples: [],
  selectedGenerationId: null,
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

function toRecord(
  row: ProjectRow,
  examples: StoredExample[],
  generations: ProjectGeneration[],
): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    modelId: row.modelId,
    analyzerId: row.analyzerId,
    analysisModelId: row.analysisModelId,
    styleHint: row.styleHint,
    generations,
    examples,
    selectedGenerationId: row.selectedGenerationId,
    selectedIndex: row.selectedIndex,
    updateText: row.updateText,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    lastOpenedAt: row.lastOpenedAt.getTime(),
  };
}

async function migrateLegacyExamples(row: ProjectRow): Promise<void> {
  if (!Array.isArray(row.examples) || row.examples.length === 0) {
    return;
  }

  const parsed = parseStoredExamples(row.examples);
  const existing = await countProjectExamples(row.userId, row.id);
  if (existing === 0 && parsed) {
    let sortOrder = 0;
    for (const example of parsed.slice(0, MAX_PROJECT_EXAMPLES)) {
      const image = parseDataUrl(example.previewUrl);
      if (!image) {
        continue;
      }
      await insertLegacyExample(row.userId, row.id, {
        name: example.name,
        mimeType: image.mimeType,
        bytes: image.bytes,
        sortOrder,
      });
      sortOrder += 1;
    }
  }

  await db
    .update(project)
    .set({ examples: [] })
    .where(eq(project.id, row.id));
}

async function migrateLegacyGenerations(row: ProjectRow): Promise<void> {
  if (!Array.isArray(row.images) || row.images.length === 0) {
    return;
  }

  const existing = await countProjectGenerations(row.userId, row.id);
  if (existing === 0) {
    const stored = await backfillLegacyGeneration(row.userId, row.id, {
      prompt: row.prompt,
      modelId: row.modelId,
      analyzerId: row.analyzerId,
      analysisModelId: row.analysisModelId,
      styleHint: row.styleHint,
      images: row.images,
    });
    if (!stored && row.images.some((image) => parseDataUrl(image))) {
      return;
    }
  }

  await db
    .update(project)
    .set({ images: [] })
    .where(eq(project.id, row.id));
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
    images: [],
    examples: [],
    selectedGenerationId: snapshot.selectedGenerationId,
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

  if (!row) {
    return null;
  }

  await migrateLegacyExamples(row);
  await migrateLegacyGenerations(row);
  const examples = await listProjectExampleMeta(userId, projectId);
  const generations = await listProjectGenerations(userId, projectId);
  const [fresh] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);
  return toRecord(fresh ?? row, examples, generations);
}

export async function listProjects(userId: string): Promise<ProjectListResult> {
  let rows = await listProjectRows(userId);

  if (rows.length === 0) {
    const generation = await getUserGeneration(userId);
    if (generation) {
      const created = await insertProject(userId, "Untitled", {
        prompt: generation.prompt,
        modelId: generation.modelId,
        analyzerId: generation.analyzerId,
        analysisModelId: generation.analysisModelId ?? null,
        styleHint: generation.styleHint,
        generations: [],
        examples: [],
        selectedGenerationId: null,
        selectedIndex: null,
        updateText: "",
      });
      if (generation.images.length > 0) {
        try {
          await backfillLegacyGeneration(userId, created.id, {
            prompt: generation.prompt,
            modelId: generation.modelId,
            analyzerId: generation.analyzerId,
            analysisModelId: generation.analysisModelId ?? null,
            styleHint: generation.styleHint,
            images: generation.images,
          });
        } catch {
          // Keep the new project listable if legacy images cannot be stored.
        }
      }
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
  if (patch.selectedGenerationId !== undefined) {
    updates.selectedGenerationId = patch.selectedGenerationId;
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
    parentGenerationId?: string | null;
  },
): Promise<ProjectGeneration> {
  await patchProject(userId, projectId, {
    prompt: record.prompt,
    modelId: record.modelId,
    analyzerId: record.analyzerId,
    analysisModelId: record.analysisModelId ?? null,
    styleHint: record.styleHint,
  });

  const generation = await createProjectGeneration(userId, projectId, {
    prompt: record.prompt,
    modelId: record.modelId,
    analyzerId: record.analyzerId,
    analysisModelId: record.analysisModelId ?? null,
    styleHint: record.styleHint,
    parentGenerationId: record.parentGenerationId,
    images: record.images,
  });
  if (!generation) {
    throw new Error("No images were returned.");
  }
  return generation;
}

export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<ProjectListResult & { replacement: ProjectRecord | null }> {
  const existing = await getOwnedProject(userId, projectId);
  if (!existing) {
    throw new ProjectNotFoundError();
  }

  await deleteProjectExamples(userId, projectId);
  await deleteProjectGenerations(userId, projectId);
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
