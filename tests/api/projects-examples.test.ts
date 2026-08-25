import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/projects/[id]/examples/[eid]/route";
import { POST } from "@/app/api/projects/[id]/examples/route";
import {
  createProjectExample,
  deleteProjectExample,
  ExampleLimitError,
  ExampleNotFoundError,
} from "@/lib/account/examples";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { formRequest, routeParams, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/examples", async () => {
  const actual = await import("./errors");
  return {
    ExampleLimitError: actual.ExampleLimitError,
    ExampleNotFoundError: actual.ExampleNotFoundError,
    ExampleUploadError: actual.ExampleUploadError,
    createProjectExample: vi.fn(),
    deleteProjectExample: vi.fn(),
  };
});

const requireUserMock = vi.mocked(requireUser);
const createMock = vi.mocked(createProjectExample);
const deleteMock = vi.mocked(deleteProjectExample);
const POST_URL = "http://localhost/api/projects/proj-1/examples";
const DELETE_URL = "http://localhost/api/projects/proj-1/examples/ex-1";
const idParams = routeParams({ id: "proj-1" });
const eidParams = routeParams({ id: "proj-1", eid: "ex-1" });

function imageFile() {
  return new File([new Uint8Array([1, 2, 3])], "meme.png", {
    type: "image/png",
  });
}

describe("POST /api/projects/[id]/examples", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserMock.mockRejectedValue(new AuthRequiredError());
    const response = await POST(
      formRequest(POST_URL, { file: imageFile() }),
      idParams,
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 when no file is provided", async () => {
    const response = await POST(formRequest(POST_URL, {}), idParams);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Please choose an image file.",
    });
  });

  it("returns the saved example", async () => {
    const example = { id: "ex-1", name: "meme.png" };
    createMock.mockResolvedValue(example as never);
    const file = imageFile();
    const response = await POST(formRequest(POST_URL, { file }), idParams);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ example });
    expect(createMock).toHaveBeenCalledWith(USER.id, "proj-1", file);
  });

  it("returns 400 when the example limit is reached", async () => {
    createMock.mockRejectedValue(new ExampleLimitError());
    const response = await POST(
      formRequest(POST_URL, { file: imageFile() }),
      idParams,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/example/i);
  });
});

describe("DELETE /api/projects/[id]/examples/[eid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
    deleteMock.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserMock.mockRejectedValue(new AuthRequiredError());
    const response = await DELETE(
      new Request(DELETE_URL, { method: "DELETE" }),
      eidParams,
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 when the example is missing", async () => {
    deleteMock.mockRejectedValue(new ExampleNotFoundError());
    const response = await DELETE(
      new Request(DELETE_URL, { method: "DELETE" }),
      eidParams,
    );
    expect(response.status).toBe(404);
  });

  it("returns 404 when the project is missing", async () => {
    deleteMock.mockRejectedValue(new ProjectNotFoundError());
    const response = await DELETE(
      new Request(DELETE_URL, { method: "DELETE" }),
      eidParams,
    );
    expect(response.status).toBe(404);
  });

  it("returns ok on success", async () => {
    const response = await DELETE(
      new Request(DELETE_URL, { method: "DELETE" }),
      eidParams,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteMock).toHaveBeenCalledWith(USER.id, "proj-1", "ex-1");
  });
});
