import { and, asc, count, desc, eq } from "drizzle-orm";
import {
  GenerationLimitError,
  GenerationNotFoundError,
  ProjectNotFoundError,
} from "@/lib/account/errors";
import { db } from "@/lib/db";
import {
  project,
  projectGeneration,
  projectGenerationImage,
} from "@/lib/db/schema";
import { compressImageBytes } from "@/lib/images/compress-server";
import { MAX_PROJECT_GENERATIONS } from "@/lib/images/constants";
import type { ProjectGeneration } from "@/lib/generation/types";

export { GenerationLimitError, GenerationNotFoundError };

type PreparedImage = {
  mimeType: string;
  bytes: Buffer;
};

export function projectGenerationImageUrl(
  projectId: string,
  generationId: string,
  imageId: string,
): string {
  return `/api/projects/${projectId}/generations/${generationId}/images/${imageId}`;
}

function payloadToBytes(payload: Buffer | Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  const source =
    payload instanceof ArrayBuffer ? new Uint8Array(payload) : new Uint8Array(payload);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

export function parseDataUrl(
  dataUrl: string,
): { mimeType: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

async function assertOwnedProject(userId: string, projectId: string) {
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);

  if (!row) {
    throw new ProjectNotFoundError();
  }
}

async function touchProject(userId: string, projectId: string) {
  await db
    .update(project)
    .set({ updatedAt: new Date() })
    .where(and(eq(project.id, projectId), eq(project.userId, userId)));
}

async function compressDataUrl(
  dataUrl: string,
  index: number,
): Promise<PreparedImage | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return null;
  }

  const file = await compressImageBytes(
    parsed.bytes,
    `meme-${index + 1}.jpg`,
  );
  return {
    mimeType: file.type || "image/jpeg",
    bytes: Buffer.from(await file.arrayBuffer()),
  };
}

function toProjectGeneration(
  projectId: string,
  row: typeof projectGeneration.$inferSelect,
  images: Array<{ id: string }>,
): ProjectGeneration {
  return {
    id: row.id,
    createdAt: row.createdAt.getTime(),
    prompt: row.prompt,
    modelId: row.modelId,
    analyzerId: row.analyzerId,
    analysisModelId: row.analysisModelId,
    styleHint: row.styleHint,
    parentGenerationId: row.parentGenerationId,
    images: images.map((image) => ({
      id: image.id,
      url: projectGenerationImageUrl(projectId, row.id, image.id),
    })),
  };
}

export async function countProjectGenerations(
  userId: string,
  projectId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(projectGeneration)
    .where(
      and(
        eq(projectGeneration.projectId, projectId),
        eq(projectGeneration.userId, userId),
      ),
    );

  return row?.value ?? 0;
}

export async function listProjectGenerations(
  userId: string,
  projectId: string,
): Promise<ProjectGeneration[]> {
  const rows = await db
    .select()
    .from(projectGeneration)
    .where(
      and(
        eq(projectGeneration.projectId, projectId),
        eq(projectGeneration.userId, userId),
      ),
    )
    .orderBy(desc(projectGeneration.createdAt))
    .limit(MAX_PROJECT_GENERATIONS);

  if (rows.length === 0) {
    return [];
  }

  const imageRows = await db
    .select({
      id: projectGenerationImage.id,
      generationId: projectGenerationImage.generationId,
    })
    .from(projectGenerationImage)
    .where(
      and(
        eq(projectGenerationImage.projectId, projectId),
        eq(projectGenerationImage.userId, userId),
      ),
    )
    .orderBy(asc(projectGenerationImage.sortOrder));

  const imagesByGeneration = new Map<string, Array<{ id: string }>>();
  for (const image of imageRows) {
    const list = imagesByGeneration.get(image.generationId) ?? [];
    list.push({ id: image.id });
    imagesByGeneration.set(image.generationId, list);
  }

  return rows.map((row) =>
    toProjectGeneration(projectId, row, imagesByGeneration.get(row.id) ?? []),
  );
}

export type CreateProjectGenerationInput = {
  prompt: string;
  modelId: string;
  analyzerId: string;
  analysisModelId: string | null;
  styleHint: string;
  parentGenerationId?: string | null;
  images: string[];
};

export async function createProjectGeneration(
  userId: string,
  projectId: string,
  input: CreateProjectGenerationInput,
  options?: { skipInvalid?: boolean },
): Promise<ProjectGeneration | null> {
  await assertOwnedProject(userId, projectId);

  if (
    (await countProjectGenerations(userId, projectId)) >= MAX_PROJECT_GENERATIONS
  ) {
    throw new GenerationLimitError();
  }

  const parentGenerationId = input.parentGenerationId?.trim() || null;
  if (parentGenerationId) {
    const [parent] = await db
      .select({ id: projectGeneration.id })
      .from(projectGeneration)
      .where(
        and(
          eq(projectGeneration.id, parentGenerationId),
          eq(projectGeneration.projectId, projectId),
          eq(projectGeneration.userId, userId),
        ),
      )
      .limit(1);

    if (!parent) {
      throw new GenerationNotFoundError("Parent generation not found.");
    }
  }

  const prepared: PreparedImage[] = [];
  for (const [index, dataUrl] of input.images.entries()) {
    try {
      const image = await compressDataUrl(dataUrl, index);
      if (!image) {
        if (options?.skipInvalid) {
          continue;
        }
        throw new Error("Generated image could not be stored.");
      }
      prepared.push(image);
    } catch (error) {
      if (options?.skipInvalid) {
        continue;
      }
      throw error;
    }
  }

  if (prepared.length === 0) {
    if (options?.skipInvalid) {
      return null;
    }
    throw new Error("No images were returned.");
  }

  const created = await db.transaction(async (tx) => {
    const [total] = await tx
      .select({ value: count() })
      .from(projectGeneration)
      .where(
        and(
          eq(projectGeneration.projectId, projectId),
          eq(projectGeneration.userId, userId),
        ),
      );

    if ((total?.value ?? 0) >= MAX_PROJECT_GENERATIONS) {
      throw new GenerationLimitError();
    }

    const id = crypto.randomUUID();
    const now = new Date();
    await tx.insert(projectGeneration).values({
      id,
      projectId,
      userId,
      prompt: input.prompt,
      modelId: input.modelId,
      analyzerId: input.analyzerId,
      analysisModelId: input.analysisModelId,
      styleHint: input.styleHint,
      parentGenerationId,
      createdAt: now,
    });

    const images: Array<{ id: string }> = [];
    for (const [index, image] of prepared.entries()) {
      const imageId = crypto.randomUUID();
      await tx.insert(projectGenerationImage).values({
        id: imageId,
        generationId: id,
        projectId,
        userId,
        mimeType: image.mimeType,
        payload: image.bytes,
        sortOrder: index,
      });
      images.push({ id: imageId });
    }

    return {
      id,
      projectId,
      userId,
      prompt: input.prompt,
      modelId: input.modelId,
      analyzerId: input.analyzerId,
      analysisModelId: input.analysisModelId,
      styleHint: input.styleHint,
      parentGenerationId,
      createdAt: now,
      images,
    };
  });

  await touchProject(userId, projectId);
  return toProjectGeneration(projectId, created, created.images);
}

export async function backfillLegacyGeneration(
  userId: string,
  projectId: string,
  input: CreateProjectGenerationInput,
): Promise<boolean> {
  const valid = input.images.filter((image) => parseDataUrl(image));
  if (valid.length === 0) {
    return false;
  }

  const generation = await createProjectGeneration(
    userId,
    projectId,
    { ...input, images: valid },
    { skipInvalid: true },
  );
  return generation !== null;
}

export async function deleteProjectGeneration(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<void> {
  await assertOwnedProject(userId, projectId);

  const [existing] = await db
    .select({ id: projectGeneration.id })
    .from(projectGeneration)
    .where(
      and(
        eq(projectGeneration.id, generationId),
        eq(projectGeneration.projectId, projectId),
        eq(projectGeneration.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new GenerationNotFoundError();
  }

  await db
    .delete(projectGenerationImage)
    .where(eq(projectGenerationImage.generationId, generationId));
  await db
    .delete(projectGeneration)
    .where(eq(projectGeneration.id, generationId));

  await db
    .update(project)
    .set({
      selectedGenerationId: null,
      selectedIndex: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(project.id, projectId),
        eq(project.userId, userId),
        eq(project.selectedGenerationId, generationId),
      ),
    );

  await touchProject(userId, projectId);
}

export async function getProjectGenerationImage(
  userId: string,
  projectId: string,
  generationId: string,
  imageId: string,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string }> {
  const [row] = await db
    .select({
      payload: projectGenerationImage.payload,
      mimeType: projectGenerationImage.mimeType,
    })
    .from(projectGenerationImage)
    .where(
      and(
        eq(projectGenerationImage.id, imageId),
        eq(projectGenerationImage.generationId, generationId),
        eq(projectGenerationImage.projectId, projectId),
        eq(projectGenerationImage.userId, userId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new GenerationNotFoundError();
  }

  return {
    bytes: payloadToBytes(row.payload),
    mimeType: row.mimeType,
  };
}

export async function deleteProjectGenerations(
  userId: string,
  projectId: string,
): Promise<void> {
  await db
    .delete(projectGenerationImage)
    .where(
      and(
        eq(projectGenerationImage.projectId, projectId),
        eq(projectGenerationImage.userId, userId),
      ),
    );
  await db
    .delete(projectGeneration)
    .where(
      and(
        eq(projectGeneration.projectId, projectId),
        eq(projectGeneration.userId, userId),
      ),
    );
}
