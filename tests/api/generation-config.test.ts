import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/generation-config/route";
import { getStoredProviderFlags } from "@/lib/account/keys";
import { getSession } from "@/lib/auth/session";
import { ANALYSIS_MODELS } from "@/lib/generation/analysis-models";
import { GENERATION_MODELS } from "@/lib/generation/models";
import { STYLE_ANALYZERS } from "@/lib/generation/style/catalog";
import { USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/keys", () => ({
  getStoredProviderFlags: vi.fn(),
}));

const getSessionMock = vi.mocked(getSession);
const flagsMock = vi.mocked(getStoredProviderFlags);

describe("GET /api/generation-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns catalogs with all providers unconfigured for anonymous users", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      models: GENERATION_MODELS,
      analysisModels: ANALYSIS_MODELS,
      analyzers: STYLE_ANALYZERS,
      configured: { google: false, openai: false },
    });
    expect(flagsMock).not.toHaveBeenCalled();
  });

  it("uses stored provider flags when signed in", async () => {
    getSessionMock.mockResolvedValue({ user: USER } as never);
    flagsMock.mockResolvedValue({ google: true, openai: false });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toEqual({ google: true, openai: false });
    expect(flagsMock).toHaveBeenCalledWith(USER.id);
  });
});
