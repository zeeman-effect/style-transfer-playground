import { getAnalysisModelById } from "../analysis-models";
import { hasProviderKey, providerNotConfiguredMessage } from "../config";
import { getModelById } from "../models";
import type { ProviderId, ProviderKeys } from "../types";
import { GenerationClientError } from "../types";
import { GoogleModelProvider } from "./google";
import { OpenAIModelProvider } from "./openai";
import type { ModelProvider } from "./types";

export function createModelProvider(
  modelId: string,
  keys: ProviderKeys,
): ModelProvider {
  const model = getModelById(modelId) ?? getAnalysisModelById(modelId);
  if (!model) {
    throw new GenerationClientError(`Unknown model: ${modelId}`);
  }

  return createModelProviderFor(model.provider, keys);
}

export function createModelProviderFor(
  provider: ProviderId,
  keys: ProviderKeys,
): ModelProvider {
  if (!hasProviderKey(keys, provider)) {
    throw new GenerationClientError(providerNotConfiguredMessage(provider));
  }

  const apiKey = keys[provider]!.trim();
  if (provider === "google") {
    return new GoogleModelProvider(apiKey);
  }

  return new OpenAIModelProvider(apiKey);
}
