import type { GenerationModel } from "./types";

export const GENERATION_MODELS: GenerationModel[] = [
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2",
    provider: "google",
  },
  {
    id: "gemini-3.1-flash-lite-image",
    label: "Nano Banana 2 Lite",
    provider: "google",
  },
  {
    id: "gemini-3-pro-image",
    label: "Nano Banana Pro",
    provider: "google",
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    provider: "openai",
  },
];

export function getModelById(modelId: string): GenerationModel | undefined {
  return GENERATION_MODELS.find((model) => model.id === modelId);
}
