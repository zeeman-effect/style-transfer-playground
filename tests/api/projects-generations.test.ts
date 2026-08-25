import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/projects/[id]/generations/[gid]/route";
import { deleteProjectGeneration } from "@/lib/account/generations";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { routeParams, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/generations", async () => {
  const { GenerationNotFoundError } = await import("./errors");
  return {
    GenerationNotFoundError,
    deleteProjectGeneration: vi.fn(),
  };
});

const requireUserMock = vi.mocked(requireUser);
const deleteMock = vi.mocked(deleteProjectGeneration);
const params = routeParams({ id: "proj-1", gid: "gen-1" });
const URL = "http://localhost/api/projects/proj-1/generations/gen-1";

describe("DELETE /api/projects/[id]/generations/[gid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
    deleteMock.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserMock.mockRejectedValue(new AuthRequiredError());
    const response = await DELETE(new Request(URL, { method: "DELETE" }), params);
    expect(response.status).toBe(401);
  });

  it("returns ok on success", async () => {
    const response = await DELETE(new Request(URL, { method: "DELETE" }), params);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteMock).toHaveBeenCalledWith(USER.id, "proj-1", "gen-1");
  });
});
