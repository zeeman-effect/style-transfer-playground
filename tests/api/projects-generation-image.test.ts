import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/projects/[id]/generations/[gid]/images/[iid]/route";
import { ProjectNotFoundError } from "@/lib/account/errors";
import {
  GenerationNotFoundError,
  getProjectGenerationImage,
} from "@/lib/account/generations";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { routeParams, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/generations", async () => {
  const { GenerationNotFoundError } = await import("./errors");
  return {
    GenerationNotFoundError,
    getProjectGenerationImage: vi.fn(),
  };
});

const requireUserMock = vi.mocked(requireUser);
const imageMock = vi.mocked(getProjectGenerationImage);
const params = routeParams({ id: "proj-1", gid: "gen-1", iid: "img-1" });
const URL =
  "http://localhost/api/projects/proj-1/generations/gen-1/images/img-1";

describe("GET /api/projects/[id]/generations/[gid]/images/[iid]", () => {
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
    const bytes = new Uint8Array([255, 216, 255]);
    imageMock.mockResolvedValue({ bytes, mimeType: "image/jpeg" });
    const response = await GET(new Request(URL), params);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(imageMock).toHaveBeenCalledWith(USER.id, "proj-1", "gen-1", "img-1");
  });

  it("returns 404 when the generation image is missing", async () => {
    imageMock.mockRejectedValue(new GenerationNotFoundError());
    const response = await GET(new Request(URL), params);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the project is missing", async () => {
    imageMock.mockRejectedValue(new ProjectNotFoundError());
    const response = await GET(new Request(URL), params);
    expect(response.status).toBe(404);
  });
});
