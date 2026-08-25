import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/account/generation/route";
import { getUserGeneration } from "@/lib/account/generation";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/generation", () => ({
  getUserGeneration: vi.fn(),
}));

const requireUserMock = vi.mocked(requireUser);
const generationMock = vi.mocked(getUserGeneration);

describe("GET /api/account/generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserMock.mockRejectedValue(new AuthRequiredError());
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns the last generation", async () => {
    const generation = { prompt: "hi", images: [], savedAt: 1 };
    generationMock.mockResolvedValue(generation as never);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ generation });
    expect(generationMock).toHaveBeenCalledWith(USER.id);
  });
});
