import { loadProjectExampleFiles } from "@/lib/account/examples";
import {
  countProjectGenerations,
  GenerationLimitError,
  GenerationNotFoundError,
} from "@/lib/account/generations";
import { loadDecryptedUserKeys } from "@/lib/account/keys";
import {
  getProject,
  ProjectNotFoundError,
  saveGenerationToProject,
} from "@/lib/account/projects";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { getAnalysisModelById } from "@/lib/generation/analysis-models";
import {
  getConfiguredProviders,
  hasProviderKey,
  providerNotConfiguredMessage,
} from "@/lib/generation/config";
import { getModelById } from "@/lib/generation/models";
import { generateMemeImages } from "@/lib/generation/pipeline";
import type { WrapModelProvider } from "@/lib/generation/providers/types";
import { getAnalyzerById } from "@/lib/generation/style/registry";
import {
  DEFAULT_GENERATE_IMAGE_COUNT,
  GenerationClientError,
  GenerationUpstreamError,
  MAX_GENERATE_IMAGE_COUNT,
  MIN_GENERATE_IMAGE_COUNT,
} from "@/lib/generation/types";
import { MAX_PROJECT_GENERATIONS } from "@/lib/images/constants";
import {
  createGenerationRunLogger,
  LoggingModelProvider,
  safeErrorMessage,
  type GenerationRunLogger,
} from "@/lib/logging";

// 24 is the timeout/cost cap for vision + image gen, not a Vercel body cap.
export const maxDuration = 300;

export async function POST(request: Request) {
  let run: GenerationRunLogger | undefined;

  try {
    const user = await requireUser();
    const activeRun = createGenerationRunLogger(user.id);
    run = activeRun;
    const keys = await loadDecryptedUserKeys(user.id);
    activeRun.setConfiguredProviders(getConfiguredProviders(keys));

    const fail = (message: string, status: number) => {
      activeRun.markError(message);
      return Response.json({ error: message }, { status });
    };

    const formData = await request.formData();
    const promptValue = formData.get("prompt");
    const modelValue = formData.get("model");
    const analyzerValue = formData.get("analyzer");
    const analysisModelValue = formData.get("analysisModel");
    const projectIdValue = formData.get("projectId");

    if (typeof projectIdValue !== "string" || projectIdValue.trim().length === 0) {
      return fail("Project is required.", 400);
    }

    const projectId = projectIdValue.trim();
    activeRun.setProjectId(projectId);

    if (typeof promptValue !== "string" || promptValue.trim().length === 0) {
      return fail("Prompt is required.", 400);
    }

    if (typeof modelValue !== "string" || modelValue.trim().length === 0) {
      return fail("Model is required.", 400);
    }

    if (typeof analyzerValue !== "string" || analyzerValue.trim().length === 0) {
      return fail("Analyzer is required.", 400);
    }

    const modelId = modelValue.trim();
    const analyzerId = analyzerValue.trim();
    const imageModel = getModelById(modelId);
    if (!imageModel) {
      return fail(`Unknown model: ${modelId}`, 400);
    }

    if (!hasProviderKey(keys, imageModel.provider)) {
      return fail(providerNotConfiguredMessage(imageModel.provider), 400);
    }

    const analyzer = getAnalyzerById(analyzerId);
    if (!analyzer) {
      return fail(`Unknown analyzer: ${analyzerId}`, 400);
    }

    let analysisModelId: string | undefined;
    if (analyzer.requiresAnalysisModel) {
      if (
        typeof analysisModelValue !== "string" ||
        analysisModelValue.trim().length === 0
      ) {
        return fail("Analysis model is required.", 400);
      }

      analysisModelId = analysisModelValue.trim();
      const analysisModel = getAnalysisModelById(analysisModelId);
      if (!analysisModel) {
        return fail(`Unknown analysis model: ${analysisModelId}`, 400);
      }

      if (!hasProviderKey(keys, analysisModel.provider)) {
        return fail(providerNotConfiguredMessage(analysisModel.provider), 400);
      }
    }

    await getProject(user.id, projectId);

    if ((await countProjectGenerations(user.id, projectId)) >= MAX_PROJECT_GENERATIONS) {
      return fail(
        `You can keep up to ${MAX_PROJECT_GENERATIONS} generation batches. Delete a batch to generate more.`,
        400,
      );
    }

    const parentValue = formData.get("parentGenerationId");
    const parentGenerationId =
      typeof parentValue === "string" && parentValue.trim().length > 0
        ? parentValue.trim()
        : undefined;

    const examples =
      analyzerId === "noop"
        ? []
        : await loadProjectExampleFiles(user.id, projectId);

    const sourceValue = formData.get("source");
    const sourceImage =
      sourceValue instanceof File && sourceValue.size > 0
        ? sourceValue
        : undefined;

    const count = parseImageCount(formData.get("count"));
    if (count === null) {
      return fail(
        `Count must be an integer of at least ${MIN_GENERATE_IMAGE_COUNT}.`,
        400,
      );
    }

    const prompt = promptValue.trim();
    activeRun.setRequest({
      prompt,
      modelId,
      analyzerId,
      analysisModelId,
      exampleCount: examples.length,
      hasSourceImage: Boolean(sourceImage),
      imageCount: count,
    });

    const wrapProvider: WrapModelProvider = (provider) =>
      new LoggingModelProvider(provider, activeRun);

    const result = await generateMemeImages(
      {
        prompt,
        examples,
        modelId,
        analyzerId,
        analysisModelId,
        sourceImage,
        count,
        keys,
      },
      {
        wrapProvider,
        runLogger: activeRun,
      },
    );

    activeRun.markSuccess();

    const generation = await saveGenerationToProject(user.id, projectId, {
      prompt,
      modelId,
      analyzerId,
      analysisModelId,
      styleHint: result.styleHint,
      images: result.images,
      parentGenerationId,
    });

    return Response.json({ generation });
  } catch (error) {
    run?.markError(safeErrorMessage(error));

    if (error instanceof AuthRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ProjectNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof GenerationNotFoundError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof GenerationLimitError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof GenerationClientError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof GenerationUpstreamError) {
      return Response.json({ error: error.message }, { status: 502 });
    }

    const message =
      error instanceof Error ? error.message : "Image generation failed.";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    if (run) {
      await run.finish();
    }
  }
}

function parseImageCount(value: FormDataEntryValue | null): number | null {
  if (value === null) {
    return DEFAULT_GENERATE_IMAGE_COUNT;
  }
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return DEFAULT_GENERATE_IMAGE_COUNT;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const count = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(count) || count < MIN_GENERATE_IMAGE_COUNT) {
    return null;
  }

  return Math.min(count, MAX_GENERATE_IMAGE_COUNT);
}
