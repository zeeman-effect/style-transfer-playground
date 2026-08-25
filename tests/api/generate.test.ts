import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { loadProjectExampleFiles } from "@/lib/account/examples";
import { countProjectGenerations } from "@/lib/account/generations";
import { loadDecryptedUserKeys } from "@/lib/account/keys";
import {
  getProject,
  ProjectNotFoundError,
  saveGenerationToProject,
} from "@/lib/account/projects";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { generateMemeImages } from "@/lib/generation/pipeline";
import { GenerationUpstreamError } from "@/lib/generation/types";
import { MAX_PROJECT_GENERATIONS } from "@/lib/images/constants";
import { createGenerationRunLogger } from "@/lib/logging";
import { createFakeLogger, formRequest, USER } from "./helpers";

vi.mock("@/lib/auth/session", () => import("./session-mock"));
vi.mock("@/lib/account/keys", () => ({
  loadDecryptedUserKeys: vi.fn(),
}));
vi.mock("@/lib/account/projects", async () => {
  const { ProjectNotFoundError } = await import("./errors");
  return {
    ProjectNotFoundError,
    getProject: vi.fn(),
    saveGenerationToProject: vi.fn(),
  };
});
vi.mock("@/lib/account/generations", async () => {
  const { GenerationLimitError, GenerationNotFoundError } = await import(
    "./errors"
  );
  return {
    GenerationLimitError,
    GenerationNotFoundError,
    countProjectGenerations: vi.fn(),
  };
});
vi.mock("@/lib/account/examples", async () => {
  const actual = await import("./errors");
  return {
    ExampleLimitError: actual.ExampleLimitError,
    ExampleNotFoundError: actual.ExampleNotFoundError,
    ExampleUploadError: actual.ExampleUploadError,
    loadProjectExampleFiles: vi.fn(),
  };
});
vi.mock("@/lib/generation/pipeline", () => ({
  generateMemeImages: vi.fn(),
}));
vi.mock("@/lib/logging", () => ({
  createGenerationRunLogger: vi.fn(),
  LoggingModelProvider: class LoggingModelProvider {},
  safeErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error",
}));

const requireUserMock = vi.mocked(requireUser);
const loadKeysMock = vi.mocked(loadDecryptedUserKeys);
const getProjectMock = vi.mocked(getProject);
const countMock = vi.mocked(countProjectGenerations);
const examplesMock = vi.mocked(loadProjectExampleFiles);
const generateMock = vi.mocked(generateMemeImages);
const saveMock = vi.mocked(saveGenerationToProject);
const loggerFactory = vi.mocked(createGenerationRunLogger);

const GENERATE_URL = "http://localhost/api/generate";
const VALID_MODEL = "gemini-3.1-flash-image";
const generation = { id: "gen-1", prompt: "a meme", images: [] };

function validFields(extra: Record<string, string> = {}) {
  return {
    projectId: "proj-1",
    prompt: "a meme",
    model: VALID_MODEL,
    analyzer: "noop",
    ...extra,
  };
}

describe("POST /api/generate", () => {
  const logger = createFakeLogger();

  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(USER as never);
    loadKeysMock.mockResolvedValue({ google: "sk-google" });
    getProjectMock.mockResolvedValue({ id: "proj-1" } as never);
    countMock.mockResolvedValue(0);
    examplesMock.mockResolvedValue([]);
    generateMock.mockResolvedValue({ images: ["img"], styleHint: "hint" });
    saveMock.mockResolvedValue(generation as never);
    loggerFactory.mockReturnValue(logger as never);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserMock.mockRejectedValue(new AuthRequiredError());
    const response = await POST(formRequest(GENERATE_URL, validFields()));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in to continue.",
    });
  });

  it("returns 400 when project is missing", async () => {
    const response = await POST(
      formRequest(GENERATE_URL, {
        prompt: "a meme",
        model: VALID_MODEL,
        analyzer: "noop",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Project is required.",
    });
  });

  it("returns 400 when prompt is missing", async () => {
    const response = await POST(
      formRequest(GENERATE_URL, {
        projectId: "proj-1",
        model: VALID_MODEL,
        analyzer: "noop",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Prompt is required.",
    });
  });

  it("returns 400 when model is missing", async () => {
    const response = await POST(
      formRequest(GENERATE_URL, {
        projectId: "proj-1",
        prompt: "a meme",
        analyzer: "noop",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Model is required.",
    });
  });

  it("returns 400 when analyzer is missing", async () => {
    const response = await POST(
      formRequest(GENERATE_URL, {
        projectId: "proj-1",
        prompt: "a meme",
        model: VALID_MODEL,
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Analyzer is required.",
    });
  });

  it("returns 400 for an unknown model", async () => {
    const response = await POST(
      formRequest(GENERATE_URL, validFields({ model: "not-a-model" })),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unknown model: not-a-model",
    });
  });

  it("returns 400 when the model provider key is missing", async () => {
    loadKeysMock.mockResolvedValue({});
    const response = await POST(formRequest(GENERATE_URL, validFields()));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        "Google is not configured. Add a Google API key in Settings to generate with this model.",
    });
  });

  it("returns 400 when the analyzer requires an analysis model", async () => {
    const response = await POST(
      formRequest(GENERATE_URL, validFields({ analyzer: "deep" })),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Analysis model is required.",
    });
  });

  it("returns 400 for an unknown analysis model", async () => {
    const response = await POST(
      formRequest(
        GENERATE_URL,
        validFields({ analyzer: "deep", analysisModel: "not-analysis" }),
      ),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unknown analysis model: not-analysis",
    });
  });

  it("returns 400 when the project is at the generation cap", async () => {
    countMock.mockResolvedValue(MAX_PROJECT_GENERATIONS);
    const response = await POST(formRequest(GENERATE_URL, validFields()));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: `You can keep up to ${MAX_PROJECT_GENERATIONS} generation batches. Delete a batch to generate more.`,
    });
  });

  it("returns 400 for an invalid count", async () => {
    const response = await POST(
      formRequest(GENERATE_URL, validFields({ count: "0" })),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Count must be an integer of at least 1.",
    });
  });

  it("uses the default count when count is omitted", async () => {
    const response = await POST(formRequest(GENERATE_URL, validFields()));
    expect(response.status).toBe(200);
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 }),
      expect.any(Object),
    );
  });

  it("returns the saved generation on success", async () => {
    const response = await POST(formRequest(GENERATE_URL, validFields()));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ generation });
    expect(logger.markSuccess).toHaveBeenCalled();
    expect(logger.finish).toHaveBeenCalled();
  });

  it("returns 404 when the project is missing", async () => {
    getProjectMock.mockRejectedValue(new ProjectNotFoundError());
    const response = await POST(formRequest(GENERATE_URL, validFields()));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Project not found.",
    });
  });

  it("returns 502 when generation fails upstream", async () => {
    generateMock.mockRejectedValue(new GenerationUpstreamError("provider down"));
    const response = await POST(formRequest(GENERATE_URL, validFields()));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "provider down" });
  });
});
