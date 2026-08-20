import { getDatabaseUrl, isFileDatabaseUrl } from "@/lib/db/credentials";

export function isLocalFilesystemLogging(): boolean {
  return isFileDatabaseUrl(getDatabaseUrl());
}
