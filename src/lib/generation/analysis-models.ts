import type { GenerationModel } from "./types";

export const ANALYSIS_MODELS: GenerationModel[] = [
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    provider: "google",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    provider: "google",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    provider: "google",
  },
  {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    provider: "openai",
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    provider: "openai",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
  },
];

export function getAnalysisModelById(
  modelId: string,
): GenerationModel | undefined {
  return ANALYSIS_MODELS.find((model) => model.id === modelId);
}
