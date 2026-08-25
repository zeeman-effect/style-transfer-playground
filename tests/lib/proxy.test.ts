import { getSessionCookie } from "better-auth/cookies";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSiteAccessToken, SITE_ACCESS_COOKIE } from "@/lib/site-access";
import { proxy } from "@/proxy";

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: vi.fn(),
}));

const getSessionCookieMock = vi.mocked(getSessionCookie);

function request(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

describe("proxy", () => {
  beforeEach(() => {
    getSessionCookieMock.mockReturnValue(null);
    vi.stubEnv("SITE_PASSWORD", "gate");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 JSON for API routes without site access", async () => {
    const response = proxy(request("/api/generate"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Password required." });
  });

  it("redirects pages to /unlock and preserves the from path", () => {
    const response = proxy(request("/projects?x=1"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/unlock?from=%2Fprojects%3Fx%3D1",
    );
  });

  it("lets /unlock through until the cookie is valid, then redirects out", () => {
    const locked = proxy(request("/unlock"));
    expect(locked.status).toBe(200);
    expect(locked.headers.get("location")).toBeNull();

    const token = createSiteAccessToken();
    const unlocked = proxy(
      request("/unlock?from=/settings", `${SITE_ACCESS_COOKIE}=${token}`),
    );
    expect(unlocked.status).toBe(307);
    expect(unlocked.headers.get("location")).toBe("http://localhost/settings");
  });

  it("sanitizes an open-redirect from= on /unlock after access", () => {
    const token = createSiteAccessToken();
    const response = proxy(
      request(
        "/unlock?from=https://evil.com",
        `${SITE_ACCESS_COOKIE}=${token}`,
      ),
    );
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("requires a session cookie for /settings", () => {
    const token = createSiteAccessToken();
    const blocked = proxy(
      request("/settings", `${SITE_ACCESS_COOKIE}=${token}`),
    );
    expect(blocked.headers.get("location")).toBe("http://localhost/sign-in");

    getSessionCookieMock.mockReturnValue("session");
    const allowed = proxy(
      request("/settings/keys", `${SITE_ACCESS_COOKIE}=${token}`),
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("location")).toBeNull();
  });

  it("redirects /unlock home when SITE_PASSWORD is unset", () => {
    vi.stubEnv("SITE_PASSWORD", "");
    delete process.env.SITE_PASSWORD;
    const response = proxy(request("/unlock"));
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
