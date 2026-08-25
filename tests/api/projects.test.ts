import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/projects/route";
import { createProject, listProjects } from "@/lib/account/projects";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/projects", async () => {
  const { ProjectNotFoundError } = await import("./errors");
  return {
    ProjectNotFoundError,
    listProjects: vi.fn(),
    createProject: vi.fn(),
  };
});

const requireUserMock = vi.mocked(requireUser);
const listMock = vi.mocked(listProjects);
const createMock = vi.mocked(createProject);

describe("/api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await GET();
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: "Sign in to continue.",
      });
    });

    it("returns the project list", async () => {
      const result = {
        projects: [{ id: "p1", name: "One", updatedAt: 1 }],
        lastOpenedId: "p1",
      };
      listMock.mockResolvedValue(result);
      const response = await GET();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(result);
      expect(listMock).toHaveBeenCalledWith(USER.id);
    });
  });

  describe("POST", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await POST();
      expect(response.status).toBe(401);
    });

    it("returns the created project", async () => {
      const project = { id: "p2", name: "Untitled" };
      createMock.mockResolvedValue(project as never);
      const response = await POST();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ project });
      expect(createMock).toHaveBeenCalledWith(USER.id);
    });
  });
});
