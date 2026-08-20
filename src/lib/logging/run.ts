import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredGenerationRunCall } from "@/lib/db/schema";
import type { GeneratedImage, ProviderId } from "@/lib/generation/types";
import { isLocalFilesystemLogging } from "./env";
import { tryAppendJsonl, tryWriteJsonFile } from "./jsonl";
import {
  extensionForMimeType,
  runDir,
  runFilePath,
  toLogPath,
  userLogsDir,
} from "./paths";
import { tryPersistGenerationRun } from "./persist-run";
import { redactString, warnLoggingFailure } from "./redact";
import type {
  GenerationRunImagePaths,
  GenerationRunRequestMeta,
  ModelCallRecord,
} from "./types";

function createRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}_${randomUUID().slice(0, 8)}`;
}

export class GenerationRunLogger {
  readonly userId: string;
  readonly runId: string;
  private readonly startedAtMs: number;
  private readonly startedAt: string;
  private callSeq = 0;
  private writeChain: Promise<void> = Promise.resolve();
  private request: GenerationRunRequestMeta | undefined;
  private projectId: string | undefined;
  private configuredProviders: Record<ProviderId, boolean> | undefined;
  private styleHint: string | undefined;
  private success = false;
  private errorMessage: string | undefined;
  private readonly storedCalls: StoredGenerationRunCall[] = [];
  private readonly imagePaths: GenerationRunImagePaths = {
    examples: [],
    candidates: [],
    ranked: [],
  };

  constructor(userId: string) {
    this.userId = userId;
    this.runId = createRunId();
    this.startedAtMs = Date.now();
    this.startedAt = new Date(this.startedAtMs).toISOString();
  }

  nextCallSeq(): number {
    this.callSeq += 1;
    return this.callSeq;
  }

  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  setConfiguredProviders(configured: Record<ProviderId, boolean>): void {
    this.configuredProviders = {
      google: Boolean(configured.google),
      openai: Boolean(configured.openai),
    };
  }

  setRequest(request: GenerationRunRequestMeta): void {
    this.request = {
      prompt: request.prompt,
      modelId: request.modelId,
      analyzerId: request.analyzerId,
      analysisModelId: request.analysisModelId,
      exampleCount: request.exampleCount,
      hasSourceImage: request.hasSourceImage,
    };
  }

  setStyleHint(styleHint: string): void {
    this.styleHint = styleHint;
  }

  markSuccess(): void {
    this.success = true;
    this.errorMessage = undefined;
  }

  markError(message: string): void {
    if (this.success) {
      return;
    }
    this.errorMessage = message;
  }

  async saveExampleImage(index: number, file: File): Promise<void> {
    const relative = await this.saveFile(
      ["images", "examples", String(index)],
      file,
    );
    if (relative) {
      this.imagePaths.examples[index] = relative;
    }
  }

  async saveSourceImage(file: File): Promise<void> {
    const relative = await this.saveFile(["images", "source"], file);
    if (relative) {
      this.imagePaths.source = relative;
    }
  }

  async saveCompositeImage(file: File): Promise<void> {
    const relative = await this.saveFile(["images", "composite"], file);
    if (relative) {
      this.imagePaths.composite = relative;
    }
  }

  async saveCandidateImage(
    index: number,
    image: GeneratedImage,
  ): Promise<void> {
    const relative = await this.saveGenerated(
      ["images", "candidates", String(index)],
      image,
    );
    if (relative) {
      this.imagePaths.candidates[index] = relative;
    }
  }

  async saveRankedImage(index: number, image: GeneratedImage): Promise<void> {
    const relative = await this.saveGenerated(
      ["images", "ranked", String(index)],
      image,
    );
    if (relative) {
      this.imagePaths.ranked[index] = relative;
    }
  }

  async saveCallInputImage(
    seq: number,
    file: File,
    index?: number,
  ): Promise<string | undefined> {
    const stem =
      index === undefined
        ? `${padSeq(seq)}-input`
        : `${padSeq(seq)}-input-${index}`;
    return this.saveFile(["images", "calls", stem], file);
  }

  async saveCallOutputImages(
    seq: number,
    images: GeneratedImage[],
  ): Promise<string[]> {
    const paths: string[] = [];
    for (const [index, image] of images.entries()) {
      const relative = await this.saveGenerated(
        ["images", "calls", `${padSeq(seq)}-output-${index}`],
        image,
      );
      if (relative) {
        paths.push(relative);
      }
    }
    return paths;
  }

  async recordCall(record: ModelCallRecord): Promise<void> {
    this.storedCalls.push(toStoredCall(record));
    if (!isLocalFilesystemLogging()) {
      return;
    }

    const filePath = runFilePath(this.userId, this.runId, "calls.jsonl");
    await this.enqueue(async () => {
      await tryAppendJsonl("calls", filePath, record);
    });
  }

  async finish(): Promise<void> {
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - this.startedAtMs;
    const configuredProviders = this.configuredProviders ?? {
      google: false,
      openai: false,
    };
    const summary = {
      runId: this.runId,
      userId: this.userId,
      timestamp: this.startedAt,
      prompt: this.request?.prompt,
      modelId: this.request?.modelId,
      analyzerId: this.request?.analyzerId,
      analysisModelId: this.request?.analysisModelId,
      success: this.success,
      error: this.success ? undefined : this.errorMessage,
      durationMs,
      configuredProviders,
    };
    const runRecord = {
      runId: this.runId,
      userId: this.userId,
      startedAt: this.startedAt,
      finishedAt,
      durationMs,
      success: this.success,
      error: this.success ? undefined : this.errorMessage,
      request: this.request,
      configuredProviders,
      styleHint: this.styleHint,
      images: {
        examples: compactSparse(this.imagePaths.examples),
        source: this.imagePaths.source,
        composite: this.imagePaths.composite,
        candidates: compactSparse(this.imagePaths.candidates),
        ranked: compactSparse(this.imagePaths.ranked),
      },
    };

    await tryPersistGenerationRun({
      id: this.runId,
      userId: this.userId,
      projectId: this.projectId ?? null,
      prompt: redactString(this.request?.prompt ?? ""),
      modelId: this.request?.modelId ?? "",
      analyzerId: this.request?.analyzerId ?? "",
      analysisModelId: this.request?.analysisModelId ?? null,
      exampleCount: this.request?.exampleCount ?? 0,
      hasSourceImage: this.request?.hasSourceImage ?? false,
      styleHint: this.styleHint ? redactString(this.styleHint) : null,
      success: this.success,
      error: this.success
        ? null
        : this.errorMessage
          ? redactString(this.errorMessage)
          : null,
      durationMs,
      configuredProviders,
      calls: this.storedCalls,
      startedAt: new Date(this.startedAtMs),
      finishedAt: new Date(),
    });

    if (!isLocalFilesystemLogging()) {
      return;
    }

    await this.enqueue(async () => {
      await tryWriteJsonFile(
        "run.json",
        runFilePath(this.userId, this.runId, "run.json"),
        runRecord,
      );
      await tryAppendJsonl(
        "index",
        path.join(userLogsDir(this.userId), "index.jsonl"),
        summary,
      );
    });
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const next = this.writeChain.then(work, work);
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async saveFile(
    segmentsWithoutExt: string[],
    file: File,
  ): Promise<string | undefined> {
    if (!isLocalFilesystemLogging()) {
      return undefined;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return await this.writeImageBytes(
        segmentsWithoutExt,
        bytes,
        file.type || "image/png",
      );
    } catch (error) {
      warnLoggingFailure("save-image", error);
      return undefined;
    }
  }

  private async saveGenerated(
    segmentsWithoutExt: string[],
    image: GeneratedImage,
  ): Promise<string | undefined> {
    if (!isLocalFilesystemLogging()) {
      return undefined;
    }

    try {
      return await this.writeImageBytes(
        segmentsWithoutExt,
        image.bytes,
        image.mimeType || "image/png",
      );
    } catch (error) {
      warnLoggingFailure("save-image", error);
      return undefined;
    }
  }

  private async writeImageBytes(
    segmentsWithoutExt: string[],
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<string | undefined> {
    if (!isLocalFilesystemLogging()) {
      return undefined;
    }

    const extension = extensionForMimeType(mimeType);
    const relative = toLogPath(...segmentsWithoutExt) + `.${extension}`;
    const absPath = path.join(
      runDir(this.userId, this.runId),
      ...relative.split("/"),
    );

    try {
      await this.enqueue(async () => {
        await mkdir(path.dirname(absPath), { recursive: true });
        await writeFile(absPath, Buffer.from(bytes));
      });
      return relative;
    } catch (error) {
      warnLoggingFailure("save-image", error);
      return undefined;
    }
  }
}

export function createGenerationRunLogger(userId: string): GenerationRunLogger {
  return new GenerationRunLogger(userId);
}

function toStoredCall(record: ModelCallRecord): StoredGenerationRunCall {
  const stored: StoredGenerationRunCall = {
    seq: record.seq,
    kind: record.kind,
    modelId: record.modelId,
    prompt: redactString(record.prompt),
    latencyMs: record.latencyMs,
  };
  if (record.provider) {
    stored.provider = record.provider;
  }
  if (record.error) {
    stored.error = redactString(record.error);
  }
  return stored;
}

function padSeq(seq: number): string {
  return String(seq).padStart(3, "0");
}

function compactSparse(values: string[]): string[] {
  return values.filter((value) => typeof value === "string" && value.length > 0);
}
