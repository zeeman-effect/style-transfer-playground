import type { ProviderId } from "@/lib/generation/types";

export type ModelCallKind =
  | "imageToText"
  | "textToText"
  | "textToImage"
  | "imageAndTextToImage";

export type KeyLifecycleAction = "added" | "updated" | "removed";

export type GenerationRunRequestMeta = {
  prompt: string;
  modelId: string;
  analyzerId: string;
  analysisModelId?: string;
  exampleCount: number;
  hasSourceImage: boolean;
  imageCount: number;
};

export type GenerationRunImagePaths = {
  examples: string[];
  source?: string;
  composite?: string;
  candidates: string[];
};

export type ModelCallRecord = {
  seq: number;
  kind: ModelCallKind;
  provider?: ProviderId;
  modelId: string;
  prompt: string;
  inputImagePaths: string[];
  outputText?: string;
  outputImagePaths: string[];
  latencyMs: number;
  error?: string;
};

export type KeyEventRecord = {
  timestamp: string;
  userId: string;
  provider: ProviderId;
  action: KeyLifecycleAction;
};
