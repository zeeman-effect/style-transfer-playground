const SECRET_FIELD_NAMES = new Set([
  "key",
  "apikey",
  "api_key",
  "ciphertext",
  "iv",
  "authorization",
  "keys",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "password",
  "secret",
  "encryption_key",
  "better_auth_secret",
  "instagramcookie",
  "instagram_cookie",
]);

const STRING_SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(Bearer)\s+\S+/gi, replacement: "$1 [REDACTED]" },
  {
    pattern: /(x-goog-api-key\s*[:=]\s*)\S+/gi,
    replacement: "$1[REDACTED]",
  },
  {
    pattern: /(Authorization\s*[:=]\s*)\S+/gi,
    replacement: "$1[REDACTED]",
  },
];

function isSecretFieldName(name: string, nested: unknown): boolean {
  if (SECRET_FIELD_NAMES.has(name.toLowerCase())) {
    return true;
  }
  // ProviderKeys uses provider ids as field names with secret string values.
  return (
    (name === "google" || name === "openai") && typeof nested === "string"
  );
}

export function redactString(value: string): string {
  let redacted = value;
  for (const { pattern, replacement } of STRING_SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

export function redactForLog(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactForLog);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    redacted[key] = isSecretFieldName(key, nested)
      ? "[REDACTED]"
      : redactForLog(nested);
  }
  return redacted;
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return redactString(error.message);
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return redactString(error);
  }
  return "Unknown error";
}

export function toRedactedJson(value: unknown, pretty = false): string {
  return JSON.stringify(redactForLog(value), null, pretty ? 2 : undefined);
}

export function warnLoggingFailure(operation: string, error: unknown): void {
  console.warn(`Logging failed (${operation}): ${safeErrorMessage(error)}`);
}
