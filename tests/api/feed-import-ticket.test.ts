import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/feed-import/ticket/route";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { getProject } from "@/lib/account/projects";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { createFeedImportToken } from "@/lib/feeds/import-token";
import { jsonRequest, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/projects", async () => {
  const { ProjectNotFoundError } = await import("./errors");
  return {
    ProjectNotFoundError,
    getProject: vi.fn(),
  };
});
vi.mock("@/lib/feeds/import-token", () => ({
  createFeedImportToken: vi.fn(),
}));

const requireUserMock = vi.mocked(requireUser);
const getProjectMock = vi.mocked(getProject);
const createTokenMock = vi.mocked(createFeedImportToken);
const URL = "http://localhost/api/feed-import/ticket";
const valid = { projectId: "proj-1", source: "someone", count: 8 };

describe("POST /api/feed-import/ticket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
    getProjectMock.mockResolvedValue({ id: "proj-1" } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserMock.mockRejectedValue(new AuthRequiredError());
    const response = await POST(jsonRequest(URL, "POST", valid));
    expect(response.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(
      jsonRequest(URL, "POST", { projectId: "proj-1", count: 8 }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing import details.",
    });
  });

  it("returns 400 for a bad count", async () => {
    const response = await POST(
      jsonRequest(URL, "POST", { ...valid, count: 0 }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Image count must be a positive integer.",
    });
  });

  it("returns 404 when the project is missing", async () => {
    getProjectMock.mockRejectedValue(new ProjectNotFoundError());
    const response = await POST(jsonRequest(URL, "POST", valid));
    expect(response.status).toBe(404);
  });

  it("returns a token", async () => {
    createTokenMock.mockResolvedValue("tok-1");
    const response = await POST(jsonRequest(URL, "POST", valid));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: "tok-1" });
    expect(createTokenMock).toHaveBeenCalledWith({
      userId: USER.id,
      projectId: "proj-1",
      source: "someone",
      count: 8,
    });
  });
});
