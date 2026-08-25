import "@testing-library/jest-dom/vitest";

const SECRET_ENV = [
  "ENCRYPTION_KEY",
  "SITE_PASSWORD",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
  "DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
];

for (const key of SECRET_ENV) {
  delete process.env[key];
}
