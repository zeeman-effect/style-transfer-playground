import { defineConfig } from "drizzle-kit";
import {
  getDatabaseAuthToken,
  getDatabaseUrl,
} from "./src/lib/db/credentials";

const url = getDatabaseUrl();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: getDatabaseAuthToken(url),
  },
});
