import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { AuthRequiredError, getSession, requireUser } from "@/lib/auth/session";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ cookie: "sid=1" })),
}));

describe("getSession / requireUser", () => {
  const getSessionMock = vi.mocked(auth.api.getSession);

  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it("forwards next/headers into better-auth", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } } as never);
    await expect(getSession()).resolves.toMatchObject({ user: { id: "u1" } });
    expect(getSessionMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
  });

  it("requireUser throws when there is no session user", async () => {
    getSessionMock.mockResolvedValue(null as never);
    await expect(requireUser()).rejects.toMatchObject({
      name: "AuthRequiredError",
      status: 401,
      message: "Sign in to continue.",
    });
    expect(new AuthRequiredError()).toBeInstanceOf(Error);
  });

  it("requireUser returns the user", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u2", name: "Ada" } } as never);
    await expect(requireUser()).resolves.toEqual({ id: "u2", name: "Ada" });
  });
});
