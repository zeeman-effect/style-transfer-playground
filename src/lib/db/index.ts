import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  getDatabaseAuthToken,
  getDatabaseUrl,
  isFileDatabaseUrl,
} from "./credentials";
import * as schema from "./schema";

function ensureLocalDatabaseDir(url: string) {
  if (!isFileDatabaseUrl(url)) {
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

const client = createClient({
  url: databaseUrl,
  authToken: getDatabaseAuthToken(databaseUrl),
});

export const db = drizzle(client, { schema });
