export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "file:./data/app.db";
}

export function isFileDatabaseUrl(url: string): boolean {
  return url.startsWith("file:");
}

export function getDatabaseAuthToken(url: string): string | undefined {
  if (isFileDatabaseUrl(url)) {
    return undefined;
  }

  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "TURSO_AUTH_TOKEN is not set. Remote DATABASE_URL requires a Turso auth token.",
    );
  }

  return token;
}
