import { createHmac, timingSafeEqual } from "node:crypto";

export const SITE_ACCESS_COOKIE = "site_access";

const ACCESS_TOKEN_MESSAGE = "site-access";
const PASSWORD_COMPARE_KEY = "site-password-compare";

export function getSitePassword(): string | null {
  const value = process.env.SITE_PASSWORD?.trim();
  return value ? value : null;
}

function hmac(key: string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function equalBuffers(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function createSiteAccessToken(): string {
  const password = getSitePassword();
  if (!password) {
    throw new Error("SITE_PASSWORD is not set.");
  }
  return hmac(password, ACCESS_TOKEN_MESSAGE).toString("hex");
}

export function isValidSiteAccessToken(token: string | undefined): boolean {
  if (!getSitePassword() || !token) {
    return false;
  }

  try {
    const expected = Buffer.from(createSiteAccessToken(), "utf8");
    const actual = Buffer.from(token, "utf8");
    return equalBuffers(expected, actual);
  } catch {
    return false;
  }
}

export function isValidSitePassword(candidate: string): boolean {
  const expected = getSitePassword();
  if (!expected) {
    return false;
  }
  return equalBuffers(
    hmac(PASSWORD_COMPARE_KEY, candidate),
    hmac(PASSWORD_COMPARE_KEY, expected),
  );
}

export function sanitizeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return "/";
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("..")
  ) {
    return "/";
  }
  if (value === "/unlock" || value.startsWith("/unlock?")) {
    return "/";
  }
  return value;
}
