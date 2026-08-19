import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "file:./data/app.db";
}

function ensureLocalDatabaseDir(url: string) {
  if (!url.startsWith("file:")) {
    return;
  }

  const filePath = url.slice("file:".length);
  const directory = dirname(filePath);
  if (directory && directory !== ".") {
    mkdirSync(directory, { recursive: true });
  }
}

const databaseUrl = getDatabaseUrl();
ensureLocalDatabaseDir(databaseUrl);

const client = createClient({ url: databaseUrl });

export const db = drizzle(client, { schema });
