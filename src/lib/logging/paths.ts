import path from "node:path";

export function sanitizePathSegment(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : "unknown";
}

export function logsRootDir(): string {
  return path.join(process.cwd(), "data", "logs");
}

export function userLogsDir(userId: string): string {
  return path.join(logsRootDir(), sanitizePathSegment(userId));
}

export function runDir(userId: string, runId: string): string {
  return path.join(userLogsDir(userId), sanitizePathSegment(runId));
}

export function runFilePath(
  userId: string,
  runId: string,
  ...segments: string[]
): string {
  return path.join(runDir(userId, runId), ...segments);
}

export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("gif")) {
    return "gif";
  }
  return "png";
}

export function toLogPath(...segments: string[]): string {
  return segments.join("/");
}
