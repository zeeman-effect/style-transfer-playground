import { getAnalysisModelById } from "../analysis-models";
import { createModelProvider } from "../providers";
import type { WrapModelProvider } from "../providers/types";
import type { AnalyzerCatalogEntry, ProviderKeys } from "../types";
import { GenerationClientError } from "../types";
import { DeepStyleAnalyzer } from "./analyzer";
import type { StyleAnalyzer } from "./analyzer";
import { NoopStyleAnalyzer } from "./noop-analyzer";

export const STYLE_ANALYZERS: AnalyzerCatalogEntry[] = [
  {
    id: "noop",
    label: "No-op",
    requiresAnalysisModel: false,
  },
  {
    id: "deep",
    label: "Deep",
    requiresAnalysisModel: true,
  },
];

export function getAnalyzerById(
  analyzerId: string,
): AnalyzerCatalogEntry | undefined {
  return STYLE_ANALYZERS.find((analyzer) => analyzer.id === analyzerId);
}

export function createStyleAnalyzer(
  analyzerId: string,
  analysisModelId: string | undefined,
  keys: ProviderKeys,
  wrapProvider?: WrapModelProvider,
): StyleAnalyzer {
  const analyzer = getAnalyzerById(analyzerId);
  if (!analyzer) {
    throw new GenerationClientError(`Unknown analyzer: ${analyzerId}`);
  }

  if (!analyzer.requiresAnalysisModel) {
    return new NoopStyleAnalyzer();
  }

  if (!analysisModelId) {
    throw new GenerationClientError(
      "Analysis model is required for this analyzer.",
    );
  }

  if (!getAnalysisModelById(analysisModelId)) {
    throw new GenerationClientError(
      `Unknown analysis model: ${analysisModelId}`,
    );
  }

  const provider = createModelProvider(analysisModelId, keys);
  const wrapped = wrapProvider ? wrapProvider(provider) : provider;
  return new DeepStyleAnalyzer(wrapped, analysisModelId);
}
