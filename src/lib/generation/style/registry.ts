import type { GenerationRunLogger } from "@/lib/logging";
import { getAnalysisModelById } from "../analysis-models";
import { createModelProvider } from "../providers";
import type { WrapModelProvider } from "../providers/types";
import type { AnalyzerCatalogEntry, ProviderKeys } from "../types";
import { GenerationClientError } from "../types";
import { DeepStyleAnalyzer } from "./analyzer";
import type { StyleAnalyzer } from "./analyzer";
import { CompositeAnalyzer } from "./composite-analyzer";
import { CompositeReferenceAnalyzer } from "./composite-reference-analyzer";
import { NoopStyleAnalyzer } from "./noop-analyzer";
import { ReferenceStyleAnalyzer } from "./reference-analyzer";

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
  {
    id: "composite",
    label: "Composite",
    requiresAnalysisModel: true,
  },
  {
    id: "reference",
    label: "Reference",
    requiresAnalysisModel: false,
  },
  {
    id: "composite-reference",
    label: "Composite-Reference",
    requiresAnalysisModel: false,
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
  runLogger?: GenerationRunLogger,
): StyleAnalyzer {
  const analyzer = getAnalyzerById(analyzerId);
  if (!analyzer) {
    throw new GenerationClientError(`Unknown analyzer: ${analyzerId}`);
  }

  if (analyzer.id === "noop") {
    return new NoopStyleAnalyzer();
  }

  if (analyzer.id === "reference") {
    return new ReferenceStyleAnalyzer();
  }

  if (analyzer.id === "composite-reference") {
    return new CompositeReferenceAnalyzer(runLogger);
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

  if (analyzer.id === "composite") {
    return new CompositeAnalyzer(wrapped, analysisModelId, runLogger);
  }

  return new DeepStyleAnalyzer(wrapped, analysisModelId);
}
