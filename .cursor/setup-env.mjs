import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Prepares a local .env for Cloud Agent / local development.
// - Copies .env.example when .env is missing.
// - Fills BETTER_AUTH_SECRET and ENCRYPTION_KEY with generated dev secrets when blank.
// - Defaults DATABASE_URL to a local SQLite file and BETTER_AUTH_URL to the dev origin.
// Real values already present in .env (or injected as process env secrets) are preserved.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(repoRoot, ".env");
const examplePath = resolve(repoRoot, ".env.example");

function parseEnv(contents) {
  const map = new Map();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return map;
}

const source = existsSync(envPath)
  ? readFileSync(envPath, "utf8")
  : existsSync(examplePath)
    ? readFileSync(examplePath, "utf8")
    : "";

const values = parseEnv(source);

function hexSecret() {
  return randomBytes(32).toString("hex");
}

const defaults = {
  BETTER_AUTH_SECRET: hexSecret,
  BETTER_AUTH_URL: () => "http://127.0.0.1:3000",
  ENCRYPTION_KEY: hexSecret,
  DATABASE_URL: () => "file:./data/app.db",
  TURSO_AUTH_TOKEN: () => "",
  GOOGLE_CLIENT_ID: () => "",
  GOOGLE_CLIENT_SECRET: () => "",
  SITE_PASSWORD: () => "",
};

const order = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "ENCRYPTION_KEY",
  "DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SITE_PASSWORD",
];

for (const key of order) {
  const current = values.get(key);
  if (current === undefined || current === "") {
    values.set(key, defaults[key]());
  }
}

const lines = order.map((key) => `${key}=${values.get(key) ?? ""}`);
writeFileSync(envPath, `${lines.join("\n")}\n`);

console.log(`Wrote ${envPath}`);

// drizzle-kit and the runtime need the local SQLite directory to exist before
// opening a file: database.
const databaseUrl = process.env.DATABASE_URL ?? values.get("DATABASE_URL") ?? "";
if (databaseUrl.startsWith("file:")) {
  const filePath = databaseUrl.slice("file:".length);
  const directory = dirname(resolve(repoRoot, filePath));
  mkdirSync(directory, { recursive: true });
  console.log(`Ensured database directory ${directory}`);
}
