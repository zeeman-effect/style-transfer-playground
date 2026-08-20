import { db } from "@/lib/db";
import { generationRun } from "@/lib/db/schema";
import { warnLoggingFailure } from "./redact";

export async function tryPersistGenerationRun(
  values: typeof generationRun.$inferInsert,
): Promise<void> {
  try {
    await db.insert(generationRun).values(values);
  } catch (error) {
    warnLoggingFailure("generation-run", error);
  }
}
