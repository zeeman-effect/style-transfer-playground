import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_ACCESS_COOKIE } from "@/lib/site-access";
import { submitSitePassword } from "@/app/unlock/actions";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const cookiesMock = vi.mocked(cookies);
const redirectMock = vi.mocked(redirect);

function form(from?: string, password?: string) {
  const data = new FormData();
  if (from !== undefined) {
    data.set("from", from);
  }
  if (password !== undefined) {
    data.set("password", password);
  }
  return data;
}

describe("submitSitePassword", () => {
  const cookieStore = { set: vi.fn() };

  beforeEach(() => {
    cookieStore.set.mockReset();
    cookiesMock.mockResolvedValue(cookieStore as never);
    redirectMock.mockClear();
    vi.stubEnv("SITE_PASSWORD", "gate");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects home when SITE_PASSWORD is unset", async () => {
    vi.stubEnv("SITE_PASSWORD", "");
    delete process.env.SITE_PASSWORD;
    await expect(submitSitePassword(form("/settings", "x"))).rejects.toThrow(
      "REDIRECT:/",
    );
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("returns to /unlock with an error for a bad password", async () => {
    await expect(submitSitePassword(form("/settings", "nope"))).rejects.toThrow(
      "REDIRECT:/unlock?error=1&from=%2Fsettings",
    );
  });

  it("sanitizes an open-redirect from value on failure", async () => {
    await expect(
      submitSitePassword(form("https://evil.com", "nope")),
    ).rejects.toThrow("REDIRECT:/unlock?error=1");
  });

  it("sets the access cookie and redirects to the sanitized path", async () => {
    await expect(submitSitePassword(form("/projects", "gate"))).rejects.toThrow(
      "REDIRECT:/projects",
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      SITE_ACCESS_COOKIE,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }),
    );
  });
});
