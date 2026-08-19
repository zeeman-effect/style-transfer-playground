import { loadDecryptedUserKeys } from "@/lib/account/keys";
import {
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
  GenerationClientError,
  GenerationUpstreamError,
} from "@/lib/generation/types";
import {
  createGenerationRunLogger,
  LoggingModelProvider,
  safeErrorMessage,
  type GenerationRunLogger,
} from "@/lib/logging";

export const maxDuration = 120;

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

    const examples = formData
      .getAll("examples")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const sourceValue = formData.get("source");
    const sourceImage =
      sourceValue instanceof File && sourceValue.size > 0
        ? sourceValue
        : undefined;

    const prompt = promptValue.trim();
    activeRun.setRequest({
      prompt,
      modelId,
      analyzerId,
      analysisModelId,
      exampleCount: examples.length,
      hasSourceImage: Boolean(sourceImage),
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
        keys,
      },
      {
        wrapProvider,
        runLogger: activeRun,
      },
    );

    activeRun.markSuccess();

    await saveGenerationToProject(user.id, projectId, {
      prompt,
      modelId,
      analyzerId,
      analysisModelId,
      styleHint: result.styleHint,
      images: result.images,
    });

    return Response.json(result);
  } catch (error) {
    run?.markError(safeErrorMessage(error));

    if (error instanceof AuthRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ProjectNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
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
