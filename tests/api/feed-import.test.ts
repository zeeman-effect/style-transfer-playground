import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "@/app/api/feed-import/route";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { importFeedExamples } from "@/lib/feeds/import";
import {
  claimFeedImportToken,
  completeFeedImportToken,
  discardFeedImportToken,
  failFeedImportToken,
  readFeedImportToken,
} from "@/lib/feeds/import-token";
import { jsonRequest, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/examples", async () => {
  const { ExampleLimitError } = await import("./errors");
  return { ExampleLimitError };
});
vi.mock("@/lib/feeds/import-token", () => ({
  claimFeedImportToken: vi.fn(),
  completeFeedImportToken: vi.fn(),
  discardFeedImportToken: vi.fn(),
  failFeedImportToken: vi.fn(),
  readFeedImportToken: vi.fn(),
}));
vi.mock("@/lib/feeds/import", () => ({
  importFeedExamples: vi.fn(),
}));

const requireUserMock = vi.mocked(requireUser);
const claimMock = vi.mocked(claimFeedImportToken);
const completeMock = vi.mocked(completeFeedImportToken);
const discardMock = vi.mocked(discardFeedImportToken);
const failMock = vi.mocked(failFeedImportToken);
const readMock = vi.mocked(readFeedImportToken);
const importMock = vi.mocked(importFeedExamples);

const URL = "http://localhost/api/feed-import";
const CDN_URL = "https://scontent.cdninstagram.com/v/t51.jpg";
const claim = {
  userId: USER.id,
  projectId: "proj-1",
  source: "someone",
  count: 4,
};

describe("/api/feed-import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
  });

  describe("POST", () => {
    it("returns 401 for an invalid token", async () => {
      claimMock.mockResolvedValue(null);
      const response = await POST(
        jsonRequest(URL, "POST", { token: "dead", urls: [CDN_URL] }),
      );
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: "This import is no longer authorized. Press Pull again.",
      });
    });

    it("returns 400 and fails the token when no urls are provided", async () => {
      claimMock.mockResolvedValue(claim as never);
      const response = await POST(
        jsonRequest(URL, "POST", { token: "abc", urls: [] }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "No usable images were found.",
        projectId: "proj-1",
      });
      expect(failMock).toHaveBeenCalledWith("abc", "No usable images were found.");
    });

    it("imports images and completes the token", async () => {
      claimMock.mockResolvedValue(claim as never);
      const examples = [{ id: "ex-1", name: "a.jpg" }];
      importMock.mockResolvedValue({ examples } as never);
      const response = await POST(
        jsonRequest(URL, "POST", { token: "abc", urls: [CDN_URL] }),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        imported: 1,
        projectId: "proj-1",
      });
      expect(importMock).toHaveBeenCalledWith(USER.id, "proj-1", {
        source: "someone",
        platform: "instagram",
        count: 4,
        instagramShortcodes: [],
        instagramImageUrls: [CDN_URL],
      });
      expect(completeMock).toHaveBeenCalledWith("abc", examples);
    });
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await GET(new Request(`${URL}?token=abc`));
      expect(response.status).toBe(401);
    });

    it("returns unknown when the token is missing", async () => {
      readMock.mockResolvedValue(null);
      const response = await GET(new Request(`${URL}?token=abc`));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: "unknown" });
      expect(readMock).toHaveBeenCalledWith("abc", USER.id);
    });

    it("returns the polled import status", async () => {
      readMock.mockResolvedValue({
        status: "done",
        projectId: "proj-1",
        examples: [{ id: "ex-1" }],
        error: null,
      } as never);
      const response = await GET(new Request(`${URL}?token=abc`));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "done",
        projectId: "proj-1",
        examples: [{ id: "ex-1" }],
        error: null,
      });
      expect(readMock).toHaveBeenCalledWith("abc", USER.id);
    });
  });

  describe("DELETE", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await DELETE(
        new Request(`${URL}?token=abc`, { method: "DELETE" }),
      );
      expect(response.status).toBe(401);
    });

    it("returns 204 after discarding the token", async () => {
      discardMock.mockResolvedValue(undefined);
      const response = await DELETE(
        new Request(`${URL}?token=abc`, { method: "DELETE" }),
      );
      expect(response.status).toBe(204);
      expect(discardMock).toHaveBeenCalledWith("abc", USER.id);
    });
  });
});
