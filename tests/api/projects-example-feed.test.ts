import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/projects/[id]/example-feed/route";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { FeedError } from "@/lib/feeds/errors";
import { importFeedExamples } from "@/lib/feeds/import";
import { jsonRequest, routeParams, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/examples", async () => {
  const { ExampleLimitError } = await import("./errors");
  return { ExampleLimitError };
});
vi.mock("@/lib/feeds/import", () => ({
  importFeedExamples: vi.fn(),
}));

const requireUserMock = vi.mocked(requireUser);
const importMock = vi.mocked(importFeedExamples);
const params = routeParams({ id: "proj-1" });
const URL = "http://localhost/api/projects/proj-1/example-feed";

describe("POST /api/projects/[id]/example-feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserMock.mockRejectedValue(new AuthRequiredError());
    const response = await POST(
      jsonRequest(URL, "POST", { source: "@me", platform: "x", count: 4 }),
      params,
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for an empty source", async () => {
    const response = await POST(
      jsonRequest(URL, "POST", { source: "  ", platform: "x" }),
      params,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter an X profile URL or @handle.",
    });
  });

  it("returns 400 when the platform is not x", async () => {
    const response = await POST(
      jsonRequest(URL, "POST", { source: "@me", platform: "instagram" }),
      params,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Choose X." });
  });

  it("returns 400 for a bad count", async () => {
    const response = await POST(
      jsonRequest(URL, "POST", { source: "@me", platform: "x", count: "nope" }),
      params,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Image count must be a positive integer.",
    });
  });

  it("returns imported examples", async () => {
    const result = { examples: [{ id: "ex-1", name: "a.jpg" }] };
    importMock.mockResolvedValue(result as never);
    const response = await POST(
      jsonRequest(URL, "POST", { source: "@me", platform: "x", count: 4 }),
      params,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(importMock).toHaveBeenCalledWith(USER.id, "proj-1", {
      source: "@me",
      platform: "x",
      count: 4,
    });
  });

  it("passes through FeedError status", async () => {
    importMock.mockRejectedValue(new FeedError("rate limited", 429));
    const response = await POST(
      jsonRequest(URL, "POST", { source: "@me", platform: "x", count: 4 }),
      params,
    );
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate limited" });
  });
});
