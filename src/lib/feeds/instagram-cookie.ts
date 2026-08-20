const STORAGE_PREFIX = "style-transfer:instagram-cookie:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function normalizeCookie(value: string) {
  return value.replace(/^Cookie:\s*/i, "").trim();
}

export function getInstagramCookie(userId: string): string {
  if (!userId) {
    return "";
  }
  try {
    return localStorage.getItem(storageKey(userId)) ?? "";
  } catch {
    return "";
  }
}

export function hasInstagramCookie(userId: string): boolean {
  return getInstagramCookie(userId).length > 0;
}

export function saveInstagramCookie(userId: string, cookie: string) {
  const value = normalizeCookie(cookie);
  if (!userId) {
    throw new Error("Sign in to save an Instagram cookie.");
  }
  if (!value) {
    throw new Error("Cookie header is required.");
  }
  try {
    localStorage.setItem(storageKey(userId), value);
  } catch {
    throw new Error("Could not save Instagram cookie.");
  }
}

export function removeInstagramCookie(userId: string) {
  if (!userId) {
    return;
  }
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    return;
  }
}
