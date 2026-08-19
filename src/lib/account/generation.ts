import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userGeneration } from "@/lib/db/schema";
import type { LastGenerationRecord } from "@/lib/generation/types";

export async function upsertUserGeneration(
  userId: string,
  record: Omit<LastGenerationRecord, "savedAt">,
): Promise<void> {
  const savedAt = new Date();
  const values = {
    userId,
    prompt: record.prompt,
    modelId: record.modelId,
    analyzerId: record.analyzerId,
    analysisModelId: record.analysisModelId ?? null,
    styleHint: record.styleHint,
    images: record.images,
    savedAt,
  };

  await db
    .insert(userGeneration)
    .values(values)
    .onConflictDoUpdate({
      target: userGeneration.userId,
      set: {
        prompt: values.prompt,
        modelId: values.modelId,
        analyzerId: values.analyzerId,
        analysisModelId: values.analysisModelId,
        styleHint: values.styleHint,
        images: values.images,
        savedAt: values.savedAt,
      },
    });
}

export async function getUserGeneration(
  userId: string,
): Promise<LastGenerationRecord | null> {
  const [row] = await db
    .select()
    .from(userGeneration)
    .where(eq(userGeneration.userId, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    prompt: row.prompt,
    modelId: row.modelId,
    analyzerId: row.analyzerId,
    analysisModelId: row.analysisModelId ?? undefined,
    styleHint: row.styleHint,
    images: row.images,
    savedAt: row.savedAt.getTime(),
  };
}
