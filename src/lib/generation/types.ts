export type ProviderId = "google" | "openai";

export type ProviderKeys = Partial<Record<ProviderId, string>>;

export type LastGenerationRecord = {
  prompt: string;
  modelId: string;
  analyzerId: string;
  analysisModelId?: string;
  styleHint: string;
  images: string[];
  savedAt: number;
};

export type StoredExample = {
  id: string;
  name: string;
  kind: "upload";
  previewUrl: string;
};

export type ProjectGenerationImage = {
  id: string;
  url: string;
};

export type ProjectGeneration = {
  id: string;
  createdAt: number;
  prompt: string;
  modelId: string;
  analyzerId: string;
  analysisModelId: string | null;
  styleHint: string;
  parentGenerationId: string | null;
  images: ProjectGenerationImage[];
};

export type ProjectSnapshot = {
  prompt: string;
  modelId: string;
  analyzerId: string;
  analysisModelId: string | null;
  styleHint: string;
  generations: ProjectGeneration[];
  examples: StoredExample[];
  selectedGenerationId: string | null;
  selectedIndex: number | null;
  updateText: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: number;
};

export type ProjectRecord = ProjectSnapshot &
  ProjectSummary & {
    createdAt: number;
    lastOpenedAt: number;
  };

export type GenerationModel = {
  id: string;
  label: string;
  provider: ProviderId;
};

export type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: string;
};

export const MIN_GENERATE_IMAGE_COUNT = 1;
export const MAX_GENERATE_IMAGE_COUNT = 6;
export const DEFAULT_GENERATE_IMAGE_COUNT = 1;

export type AnalyzerCatalogEntry = {
  id: string;
  label: string;
  requiresAnalysisModel: boolean;
  summary: string;
};

export type GenerateMemeImagesInput = {
  prompt: string;
  examples: File[];
  modelId: string;
  analyzerId: string;
  analysisModelId?: string;
  sourceImage?: File;
  count: number;
  keys: ProviderKeys;
};

export type GenerateMemeImagesResult = {
  images: string[];
  styleHint: string;
};

export type GenerationConfigResponse = {
  models: GenerationModel[];
  analysisModels: GenerationModel[];
  analyzers: AnalyzerCatalogEntry[];
  configured: Record<ProviderId, boolean>;
};

export class GenerationClientError extends Error {
  readonly status = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = "GenerationClientError";
  }
}

export class GenerationUpstreamError extends Error {
  readonly status = 502 as const;

  constructor(message: string) {
    super(message);
    this.name = "GenerationUpstreamError";
  }
}
