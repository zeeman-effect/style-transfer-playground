import type { AnalyzerCatalogEntry } from "../types";

export const STYLE_ANALYZERS: AnalyzerCatalogEntry[] = [
  {
    id: "noop",
    label: "No-op",
    requiresAnalysisModel: false,
    summary: "Skips style analysis. The image model only sees your prompt.",
  },
  {
    id: "deep",
    label: "Deep",
    requiresAnalysisModel: true,
    summary:
      "A vision model describes each example, then writes one style paragraph added to the prompt. Most expensive: one image-to-text call per example. Needs an analysis model. Example images are not sent to the image model.",
  },
  {
    id: "composite",
    label: "Composite",
    requiresAnalysisModel: true,
    summary:
      "Tiles examples into one grid and has a vision model write a style paragraph from that sheet (one vision call). Needs an analysis model. Example images are not sent to the image model.",
  },
  {
    id: "reference",
    label: "Reference",
    requiresAnalysisModel: false,
    summary:
      "Sends the example images to the image model with a fixed instruction to match look, not jokes, watermarks, or handles. No analysis model.",
  },
  {
    id: "composite-reference",
    label: "Composite-Reference",
    requiresAnalysisModel: false,
    summary:
      "Tiles examples into one grid and sends that sheet as the reference, with a fixed instruction to match the shared look. No analysis model.",
  },
];

export function getAnalyzerById(
  analyzerId: string,
): AnalyzerCatalogEntry | undefined {
  return STYLE_ANALYZERS.find((analyzer) => analyzer.id === analyzerId);
}
