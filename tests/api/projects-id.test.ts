import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "@/app/api/projects/[id]/route";
import {
  deleteProject,
  getProject,
  patchProject,
  ProjectNotFoundError,
} from "@/lib/account/projects";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { jsonRequest, routeParams, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/projects", async () => {
  const { ProjectNotFoundError } = await import("./errors");
  return {
    ProjectNotFoundError,
    getProject: vi.fn(),
    patchProject: vi.fn(),
    deleteProject: vi.fn(),
  };
});

const requireUserMock = vi.mocked(requireUser);
const getProjectMock = vi.mocked(getProject);
const patchMock = vi.mocked(patchProject);
const deleteMock = vi.mocked(deleteProject);
const URL = "http://localhost/api/projects/proj-1";
const params = routeParams({ id: "proj-1" });
const project = { id: "proj-1", name: "Mine" };

describe("/api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
    getProjectMock.mockResolvedValue(project as never);
    patchMock.mockResolvedValue(project as never);
    deleteMock.mockResolvedValue({ lastOpenedId: "p2" } as never);
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await GET(new Request(URL), params);
      expect(response.status).toBe(401);
    });

    it("returns 404 when the project is missing", async () => {
      getProjectMock.mockRejectedValue(new ProjectNotFoundError());
      const response = await GET(new Request(URL), params);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: "Project not found.",
      });
    });

    it("returns the project", async () => {
      const response = await GET(new Request(URL), params);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ project });
    });
  });

  describe("PATCH", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await PATCH(jsonRequest(URL, "PATCH", {}), params);
      expect(response.status).toBe(401);
    });

    it("returns 400 for an invalid name", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { name: 1 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid project name.",
      });
    });

    it("returns 400 for an invalid opened flag", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { opened: "yes" }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid opened flag.",
      });
    });

    it("returns 400 for an invalid prompt", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { prompt: 1 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid prompt.",
      });
    });

    it("returns 400 for an invalid model", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { modelId: 1 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid model.",
      });
    });

    it("returns 400 for an invalid analyzer", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { analyzerId: 1 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid analyzer.",
      });
    });

    it("returns 400 for an invalid analysis model", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { analysisModelId: 1 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid analysis model.",
      });
    });

    it("returns 400 for an invalid style hint", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { styleHint: 1 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid style hint.",
      });
    });

    it("returns 400 for an invalid selected generation", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { selectedGenerationId: 1 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid selected generation.",
      });
    });

    it("returns 400 for an invalid selected index", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { selectedIndex: 1.5 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid selected index.",
      });
    });

    it("returns 400 for invalid update text", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { updateText: 1 }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid update text.",
      });
    });

    it("returns 400 when the project name is required", async () => {
      patchMock.mockRejectedValue(new Error("Project name is required."));
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { name: "   " }),
        params,
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Project name is required.",
      });
    });

    it("returns 404 when the project is missing", async () => {
      patchMock.mockRejectedValue(new ProjectNotFoundError());
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { prompt: "hi" }),
        params,
      );
      expect(response.status).toBe(404);
    });

    it("returns the patched project", async () => {
      const response = await PATCH(
        jsonRequest(URL, "PATCH", { prompt: "hi", selectedIndex: null }),
        params,
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ project });
      expect(patchMock).toHaveBeenCalledWith(USER.id, "proj-1", {
        prompt: "hi",
        selectedIndex: null,
      });
    });
  });

  describe("DELETE", () => {
    it("returns 401 when unauthenticated", async () => {
      requireUserMock.mockRejectedValue(new AuthRequiredError());
      const response = await DELETE(new Request(URL, { method: "DELETE" }), params);
      expect(response.status).toBe(401);
    });

    it("returns 404 when the project is missing", async () => {
      deleteMock.mockRejectedValue(new ProjectNotFoundError());
      const response = await DELETE(new Request(URL, { method: "DELETE" }), params);
      expect(response.status).toBe(404);
    });

    it("returns the delete result", async () => {
      const response = await DELETE(new Request(URL, { method: "DELETE" }), params);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ lastOpenedId: "p2" });
    });
  });
});
