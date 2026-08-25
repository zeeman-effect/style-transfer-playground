import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "@/app/api/account/keys/route";
import {
  deleteUserProviderKey,
  getStoredProviderFlags,
  saveUserProviderKey,
} from "@/lib/account/keys";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { logKeyEvent } from "@/lib/logging";
import { jsonRequest, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/keys", () => ({
  isProviderId: (value: unknown) => value === "google" || value === "openai",
  getStoredProviderFlags: vi.fn(),
  saveUserProviderKey: vi.fn(),
  deleteUserProviderKey: vi.fn(),
}));
vi.mock("@/lib/logging", () => ({
  logKeyEvent: vi.fn(),
  safeErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error",
}));

const requireUserMock = vi.mocked(requireUser);
const flagsMock = vi.mocked(getStoredProviderFlags);
const saveMock = vi.mocked(saveUserProviderKey);
const deleteMock = vi.mocked(deleteUserProviderKey);
const logMock = vi.mocked(logKeyEvent);
const URL = "http://localhost/api/account/keys";

describe("/api/account/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await GET();
      expect(response.status).toBe(401);
    });

    it("returns stored provider flags", async () => {
      flagsMock.mockResolvedValue({ google: true, openai: false });
      const response = await GET();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        configured: { google: true, openai: false },
      });
    });
  });

  describe("PUT", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await PUT(
        jsonRequest(URL, "PUT", { provider: "google", key: "sk" }),
      );
      expect(response.status).toBe(401);
    });

    it("returns 400 for an unknown provider", async () => {
      const response = await PUT(
        jsonRequest(URL, "PUT", { provider: "anthropic", key: "sk" }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Unknown provider.",
      });
    });

    it("returns 400 for an empty key", async () => {
      const response = await PUT(
        jsonRequest(URL, "PUT", { provider: "google", key: "   " }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "API key is required.",
      });
    });

    it("saves the key and logs the event", async () => {
      saveMock.mockResolvedValue("added");
      const response = await PUT(
        jsonRequest(URL, "PUT", { provider: "openai", key: " sk-1 " }),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
      expect(saveMock).toHaveBeenCalledWith(USER.id, "openai", "sk-1");
      expect(logMock).toHaveBeenCalledWith(USER.id, "openai", "added");
    });
  });

  describe("DELETE", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await DELETE(
        jsonRequest(URL, "DELETE", { provider: "google" }),
      );
      expect(response.status).toBe(401);
    });

    it("returns 400 for an unknown provider", async () => {
      const response = await DELETE(
        jsonRequest(URL, "DELETE", { provider: "anthropic" }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Unknown provider.",
      });
    });

    it("removes the key and logs when a key was deleted", async () => {
      deleteMock.mockResolvedValue(true);
      const response = await DELETE(
        jsonRequest(URL, "DELETE", { provider: "google" }),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
      expect(logMock).toHaveBeenCalledWith(USER.id, "google", "removed");
    });
  });
});
