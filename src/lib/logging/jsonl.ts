import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { toRedactedJson, warnLoggingFailure } from "./redact";

export async function appendJsonl(
  filePath: string,
  record: unknown,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${toRedactedJson(record)}\n`, "utf8");
}

export async function writeJsonFile(
  filePath: string,
  record: unknown,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${toRedactedJson(record, true)}\n`, "utf8");
}

export async function tryAppendJsonl(
  operation: string,
  filePath: string,
  record: unknown,
): Promise<void> {
  try {
    await appendJsonl(filePath, record);
  } catch (error) {
    warnLoggingFailure(operation, error);
  }
}

export async function tryWriteJsonFile(
  operation: string,
  filePath: string,
  record: unknown,
): Promise<void> {
  try {
    await writeJsonFile(filePath, record);
  } catch (error) {
    warnLoggingFailure(operation, error);
  }
}
