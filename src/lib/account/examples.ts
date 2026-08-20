import { and, asc, count, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { project, projectExample } from "@/lib/db/schema";
import {
  MAX_EXAMPLE_UPLOAD_BYTES,
  MAX_PROJECT_EXAMPLES,
  VISION_ANALYSIS_BATCH,
} from "@/lib/images/constants";
import type { StoredExample } from "@/lib/generation/types";
import {
  ExampleLimitError,
  ExampleNotFoundError,
  ExampleUploadError,
  ProjectNotFoundError,
} from "@/lib/account/errors";

export {
  ExampleLimitError,
  ExampleNotFoundError,
  ExampleUploadError,
};

type ExampleMetaRow = {
  id: string;
  name: string;
  mimeType: string;
};

export function projectExampleImageUrl(
  projectId: string,
  exampleId: string,
): string {
  return `/api/projects/${projectId}/examples/${exampleId}/image`;
}

function toStoredExample(
  projectId: string,
  row: Pick<ExampleMetaRow, "id" | "name">,
): StoredExample {
  return {
    id: row.id,
    name: row.name,
    kind: "upload",
    previewUrl: projectExampleImageUrl(projectId, row.id),
  };
}

function payloadToBytes(payload: Buffer | Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  const source =
    payload instanceof ArrayBuffer ? new Uint8Array(payload) : new Uint8Array(payload);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
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

export async function countProjectExamples(
  userId: string,
  projectId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(projectExample)
    .where(
      and(
        eq(projectExample.projectId, projectId),
        eq(projectExample.userId, userId),
      ),
    );

  return row?.value ?? 0;
}

export async function listProjectExampleMeta(
  userId: string,
  projectId: string,
): Promise<StoredExample[]> {
  const rows = await db
    .select({
      id: projectExample.id,
      name: projectExample.name,
    })
    .from(projectExample)
    .where(
      and(
        eq(projectExample.projectId, projectId),
        eq(projectExample.userId, userId),
      ),
    )
    .orderBy(asc(projectExample.sortOrder))
    .limit(MAX_PROJECT_EXAMPLES);

  return rows.map((row) => toStoredExample(projectId, row));
}

export async function createProjectExample(
  userId: string,
  projectId: string,
  file: File,
): Promise<StoredExample> {
  await assertOwnedProject(userId, projectId);

  if (!(file instanceof File) || file.size <= 0) {
    throw new ExampleUploadError("Please choose an image file.");
  }
  if (!file.type.startsWith("image/")) {
    throw new ExampleUploadError("Please choose an image file.");
  }
  if (file.size > MAX_EXAMPLE_UPLOAD_BYTES) {
    throw new ExampleUploadError("Image is too large.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = file.name.trim() || "example.jpg";
  const mimeType = file.type || "image/jpeg";

  const created = await db.transaction(async (tx) => {
    const [total] = await tx
      .select({ value: count() })
      .from(projectExample)
      .where(
        and(
          eq(projectExample.projectId, projectId),
          eq(projectExample.userId, userId),
        ),
      );

    if ((total?.value ?? 0) >= MAX_PROJECT_EXAMPLES) {
      throw new ExampleLimitError();
    }

    const [order] = await tx
      .select({ value: max(projectExample.sortOrder) })
      .from(projectExample)
      .where(
        and(
          eq(projectExample.projectId, projectId),
          eq(projectExample.userId, userId),
        ),
      );

    const id = crypto.randomUUID();
    const now = new Date();
    await tx.insert(projectExample).values({
      id,
      projectId,
      userId,
      name,
      mimeType,
      payload: bytes,
      sortOrder: (order?.value ?? -1) + 1,
      createdAt: now,
    });

    return { id, name };
  });

  await touchProject(userId, projectId);
  return toStoredExample(projectId, created);
}

export async function deleteProjectExample(
  userId: string,
  projectId: string,
  exampleId: string,
): Promise<void> {
  await assertOwnedProject(userId, projectId);

  const [existing] = await db
    .select({ id: projectExample.id })
    .from(projectExample)
    .where(
      and(
        eq(projectExample.id, exampleId),
        eq(projectExample.projectId, projectId),
        eq(projectExample.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new ExampleNotFoundError();
  }

  await db
    .delete(projectExample)
    .where(eq(projectExample.id, exampleId));

  await touchProject(userId, projectId);
}

export async function getProjectExampleImage(
  userId: string,
  projectId: string,
  exampleId: string,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string; name: string }> {
  const [row] = await db
    .select({
      payload: projectExample.payload,
      mimeType: projectExample.mimeType,
      name: projectExample.name,
    })
    .from(projectExample)
    .where(
      and(
        eq(projectExample.id, exampleId),
        eq(projectExample.projectId, projectId),
        eq(projectExample.userId, userId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ExampleNotFoundError();
  }

  return {
    bytes: payloadToBytes(row.payload),
    mimeType: row.mimeType,
    name: row.name,
  };
}

export async function deleteProjectExamples(
  userId: string,
  projectId: string,
): Promise<void> {
  await db
    .delete(projectExample)
    .where(
      and(
        eq(projectExample.projectId, projectId),
        eq(projectExample.userId, userId),
      ),
    );
}

async function getExamplePayload(
  userId: string,
  projectId: string,
  exampleId: string,
): Promise<{ payload: Buffer; name: string; mimeType: string } | null> {
  const [row] = await db
    .select({
      payload: projectExample.payload,
      name: projectExample.name,
      mimeType: projectExample.mimeType,
    })
    .from(projectExample)
    .where(
      and(
        eq(projectExample.id, exampleId),
        eq(projectExample.projectId, projectId),
        eq(projectExample.userId, userId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function loadProjectExampleFiles(
  userId: string,
  projectId: string,
): Promise<File[]> {
  const metas = await db
    .select({
      id: projectExample.id,
      name: projectExample.name,
      mimeType: projectExample.mimeType,
    })
    .from(projectExample)
    .where(
      and(
        eq(projectExample.projectId, projectId),
        eq(projectExample.userId, userId),
      ),
    )
    .orderBy(asc(projectExample.sortOrder))
    .limit(MAX_PROJECT_EXAMPLES);

  const files: File[] = [];
  for (let i = 0; i < metas.length; i += VISION_ANALYSIS_BATCH) {
    const batch = metas.slice(i, i + VISION_ANALYSIS_BATCH);
    const loaded = await Promise.all(
      batch.map(async (meta) => {
        const row = await getExamplePayload(userId, projectId, meta.id);
        if (!row) {
          return null;
        }
        return new File([payloadToBytes(row.payload)], row.name, {
          type: row.mimeType,
        });
      }),
    );
    for (const file of loaded) {
      if (file) {
        files.push(file);
      }
    }
  }
  return files;
}

export async function insertLegacyExample(
  userId: string,
  projectId: string,
  example: { name: string; mimeType: string; bytes: Buffer; sortOrder: number },
): Promise<void> {
  await db.insert(projectExample).values({
    id: crypto.randomUUID(),
    projectId,
    userId,
    name: example.name,
    mimeType: example.mimeType,
    payload: example.bytes,
    sortOrder: example.sortOrder,
    createdAt: new Date(),
  });
}
