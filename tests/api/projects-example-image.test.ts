import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/projects/[id]/examples/[eid]/image/route";
import {
  ExampleNotFoundError,
  getProjectExampleImage,
} from "@/lib/account/examples";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { routeParams, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/examples", async () => {
  const { ExampleNotFoundError } = await import("./errors");
  return {
    ExampleNotFoundError,
    getProjectExampleImage: vi.fn(),
  };
});

const requireUserMock = vi.mocked(requireUser);
const imageMock = vi.mocked(getProjectExampleImage);
const params = routeParams({ id: "proj-1", eid: "ex-1" });
const URL = "http://localhost/api/projects/proj-1/examples/ex-1/image";

describe("GET /api/projects/[id]/examples/[eid]/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserMock.mockRejectedValue(new AuthRequiredError());
    const response = await GET(new Request(URL), params);
    expect(response.status).toBe(401);
  });

  it("returns image bytes and content-type", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    imageMock.mockResolvedValue({
      bytes,
      mimeType: "image/png",
      name: "example.png",
    });
    const response = await GET(new Request(URL), params);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(imageMock).toHaveBeenCalledWith(USER.id, "proj-1", "ex-1");
  });

  it("returns 404 when the example is missing", async () => {
    imageMock.mockRejectedValue(new ExampleNotFoundError());
    const response = await GET(new Request(URL), params);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the project is missing", async () => {
    imageMock.mockRejectedValue(new ProjectNotFoundError());
    const response = await GET(new Request(URL), params);
    expect(response.status).toBe(404);
  });
});
