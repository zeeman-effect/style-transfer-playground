"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FeedImport } from "@/components/feed-import";
import { ResultInspector } from "@/components/result-inspector";
import { authClient } from "@/lib/auth-client";
import {
  compressImageFile,
  compressResultDataUrls,
  dataUrlToFile,
} from "@/lib/images/compress-client";
import { MAX_PROJECT_EXAMPLES } from "@/lib/images/constants";
import {
  type AnalyzerCatalogEntry,
  DEFAULT_GENERATE_IMAGE_COUNT,
  type GenerationConfigResponse,
  type GenerationModel,
  MAX_GENERATE_IMAGE_COUNT,
  MIN_GENERATE_IMAGE_COUNT,
  type ProjectSnapshot,
  type ProviderId,
  type StoredExample,
} from "@/lib/generation/types";

type ExampleImage = {
  id: string;
  file: File | null;
  name: string;
  previewUrl: string;
};

type CachedExperimentSelection = {
  modelId: string | null;
  analyzerId: string | null;
  analysisModelId: string | null;
};

export type MemeGeneratorHandle = {
  flushSave: () => Promise<void>;
};

type MemeGeneratorProps = {
  projectId?: string;
  initialSnapshot?: ProjectSnapshot;
  onSaved?: () => void;
  ref?: React.Ref<MemeGeneratorHandle | null>;
};

const PROVIDERS: ProviderId[] = ["google", "openai"];

const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: "Google",
  openai: "OpenAI",
};

const SELECT_CLASS =
  "mt-2 w-full rounded-xl border-2 border-panel-edge bg-background px-4 py-3 text-base text-foreground outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

const SAVE_DEBOUNCE_MS = 1000;

function pickDefaultModelId(config: GenerationConfigResponse): string {
  const firstConfigured = config.models.find(
    (model) => config.configured[model.provider],
  );
  return firstConfigured?.id ?? config.models[0]?.id ?? "";
}

function pickModelId(
  config: GenerationConfigResponse,
  cachedModelId: string | null,
): string {
  if (
    cachedModelId &&
    config.models.some((model) => model.id === cachedModelId)
  ) {
    return cachedModelId;
  }
  return pickDefaultModelId(config);
}

function pickProviderId(
  config: GenerationConfigResponse,
  modelId: string,
): ProviderId {
  const model = config.models.find((entry) => entry.id === modelId);
  if (model) {
    return model.provider;
  }

  const firstConfigured = PROVIDERS.find(
    (provider) => config.configured[provider],
  );
  return firstConfigured ?? "google";
}

function pickAnalyzerId(
  config: GenerationConfigResponse,
  cachedAnalyzerId: string | null,
): string {
  if (
    cachedAnalyzerId &&
    config.analyzers.some((analyzer) => analyzer.id === cachedAnalyzerId)
  ) {
    return cachedAnalyzerId;
  }
  return (
    config.analyzers.find((analyzer) => analyzer.id === "noop")?.id ??
    config.analyzers[0]?.id ??
    ""
  );
}

function pickAnalysisModelId(
  config: GenerationConfigResponse,
  cachedAnalysisModelId: string | null,
): string {
  if (
    cachedAnalysisModelId &&
    config.analysisModels.some((model) => model.id === cachedAnalysisModelId)
  ) {
    return cachedAnalysisModelId;
  }

  const firstConfigured = config.analysisModels.find(
    (model) => config.configured[model.provider],
  );
  return firstConfigured?.id ?? config.analysisModels[0]?.id ?? "";
}

function pickExperimentSelection(
  config: GenerationConfigResponse,
  cached: CachedExperimentSelection,
) {
  const modelId = pickModelId(config, cached.modelId);
  return {
    providerId: pickProviderId(config, modelId),
    modelId,
    analyzerId: pickAnalyzerId(config, cached.analyzerId),
    analysisModelId: pickAnalysisModelId(config, cached.analysisModelId),
  };
}

function parseRequestedImageCount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const count = Number.parseInt(trimmed, 10);
  return Number.isInteger(count) ? count : null;
}

function resolveGenerateImageCount(value: string): number {
  const parsed = parseRequestedImageCount(value);
  if (parsed === null || parsed < MIN_GENERATE_IMAGE_COUNT) {
    return DEFAULT_GENERATE_IMAGE_COUNT;
  }
  return Math.min(parsed, MAX_GENERATE_IMAGE_COUNT);
}

function missingKeyMessage(provider: ProviderId, signedIn: boolean): string {
  const label = PROVIDER_LABELS[provider];
  const action = signedIn
    ? `Add a ${label} API key in Settings`
    : `Sign in and add a ${label} API key in Settings`;
  return `${label} is not configured. ${action} to generate with this model.`;
}

function experimentWarning(
  model: GenerationModel | undefined,
  analyzer: AnalyzerCatalogEntry | undefined,
  analysisModel: GenerationModel | undefined,
  configured: Record<ProviderId, boolean> | null,
  configFailed: boolean,
  signedIn: boolean,
): string | null {
  if (configFailed || !configured) {
    return "Could not load generation config. Generation is disabled until providers are available.";
  }
  if (!model) {
    return "No models are available.";
  }
  if (!configured[model.provider]) {
    return missingKeyMessage(model.provider, signedIn);
  }
  if (analyzer?.requiresAnalysisModel) {
    if (!analysisModel) {
      return "No analysis models are available.";
    }
    if (!configured[analysisModel.provider]) {
      return missingKeyMessage(analysisModel.provider, signedIn);
    }
  }
  return null;
}

function isLocalExampleId(id: string): boolean {
  return id.startsWith("local-");
}

function examplesFromSnapshot(snapshot?: ProjectSnapshot): ExampleImage[] {
  return (snapshot?.examples ?? [])
    .filter(
      (example) =>
        example.kind === "upload" &&
        !example.previewUrl.startsWith("/examples/"),
    )
    .map((example) => ({
      id: example.id,
      file: null,
      name: example.name,
      previewUrl: example.previewUrl,
    }));
}

export function MemeGenerator({
  projectId,
  initialSnapshot,
  onSaved,
  ref,
}: MemeGeneratorProps) {
  const inputId = useId();
  const promptId = useId();
  const providerFieldId = useId();
  const imageModelId = useId();
  const analyzerFieldId = useId();
  const analysisModelFieldId = useId();
  const imageCountFieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const examplesRef = useRef<ExampleImage[]>([]);
  const cachedSelectionRef = useRef<CachedExperimentSelection>({
    modelId: initialSnapshot?.modelId || null,
    analyzerId: initialSnapshot?.analyzerId || null,
    analysisModelId: initialSnapshot?.analysisModelId ?? null,
  });
  const configRef = useRef<GenerationConfigResponse | null>(null);
  const projectIdRef = useRef(projectId);
  const cacheReadyRef = useRef(false);
  const promptRef = useRef(initialSnapshot?.prompt ?? "");
  const modelIdRef = useRef("");
  const analyzerIdRef = useRef(initialSnapshot?.analyzerId || "noop");
  const analysisModelIdRef = useRef(initialSnapshot?.analysisModelId ?? "");
  const styleHintRef = useRef(initialSnapshot?.styleHint ?? "");
  const resultImagesRef = useRef(initialSnapshot?.images ?? []);
  const selectedIndexRef = useRef(initialSnapshot?.selectedIndex ?? null);
  const updateTextRef = useRef(initialSnapshot?.updateText ?? "");
  const onSavedRef = useRef(onSaved);
  const saveGenerationRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const pendingUploadsRef = useRef(0);
  const mountedRef = useRef(true);

  const [examples, setExamples] = useState<ExampleImage[]>(() =>
    examplesFromSnapshot(initialSnapshot),
  );
  const [prompt, setPrompt] = useState(initialSnapshot?.prompt ?? "");
  const [selectedProviderId, setSelectedProviderId] =
    useState<ProviderId>("google");
  const [selectedModelId, setSelectedModelId] = useState(
    initialSnapshot?.modelId ?? "",
  );
  const [selectedAnalyzerId, setSelectedAnalyzerId] = useState(
    initialSnapshot?.analyzerId || "noop",
  );
  const [selectedAnalysisModelId, setSelectedAnalysisModelId] = useState(
    initialSnapshot?.analysisModelId ?? "",
  );
  const [imageCount, setImageCount] = useState(
    String(DEFAULT_GENERATE_IMAGE_COUNT),
  );
  const [styleHint, setStyleHint] = useState(initialSnapshot?.styleHint ?? "");
  const [config, setConfig] = useState<GenerationConfigResponse | null>(null);
  const [configFailed, setConfigFailed] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<string[]>(
    initialSnapshot?.images ?? [],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    initialSnapshot?.selectedIndex ?? null,
  );
  const [updateText, setUpdateText] = useState(
    initialSnapshot?.updateText ?? "",
  );
  const [isDragging, setIsDragging] = useState(false);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    projectIdRef.current = projectId;
    cacheReadyRef.current = cacheReady;
    promptRef.current = prompt;
    modelIdRef.current = selectedModelId;
    analyzerIdRef.current = selectedAnalyzerId;
    analysisModelIdRef.current = selectedAnalysisModelId;
    styleHintRef.current = styleHint;
    resultImagesRef.current = resultImages;
    selectedIndexRef.current = selectedIndex;
    updateTextRef.current = updateText;
    onSavedRef.current = onSaved;
    examplesRef.current = examples;
  });

  const persist = useCallback(async (keepalive = false) => {
    const activeProjectId = projectIdRef.current;
    if (!activeProjectId || !cacheReadyRef.current) {
      return;
    }

    const generation = ++saveGenerationRef.current;
    const images = keepalive
      ? resultImagesRef.current
      : await compressResultDataUrls(resultImagesRef.current);
    if (
      generation !== saveGenerationRef.current ||
      projectIdRef.current !== activeProjectId
    ) {
      return;
    }

    if (images !== resultImagesRef.current) {
      const changed = images.some(
        (image, index) => image !== resultImagesRef.current[index],
      );
      if (changed) {
        resultImagesRef.current = images;
        setResultImages(images);
      }
    }

    const payload = {
      prompt: promptRef.current,
      modelId: modelIdRef.current,
      analyzerId: analyzerIdRef.current,
      analysisModelId: analysisModelIdRef.current || null,
      styleHint: styleHintRef.current,
      images: resultImagesRef.current,
      selectedIndex: selectedIndexRef.current,
      updateText: updateTextRef.current,
    };

    const response = await fetch(`/api/projects/${activeProjectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive,
    });

    if (generation !== saveGenerationRef.current) {
      return;
    }

    if (keepalive) {
      if (response.ok) {
        onSavedRef.current?.();
      }
      return;
    }

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Could not save project.");
    }
    onSavedRef.current?.();
  }, []);

  const flushSave = useCallback(async () => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    try {
      await persist();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save project.",
      );
      throw saveError;
    }
  }, [persist]);

  useImperativeHandle(ref, () => ({ flushSave }), [flushSave]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      examplesRef.current.forEach((example) => {
        if (example.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(example.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (sessionPending) {
      return;
    }

    let cancelled = false;

    async function loadConfig() {
      try {
        const response = await fetch("/api/generation-config");
        if (!response.ok) {
          throw new Error(`Config request failed with ${response.status}`);
        }

        const data = (await response.json()) as GenerationConfigResponse;
        if (cancelled) {
          return;
        }

        configRef.current = data;
        setConfig(data);
        setConfigFailed(false);
        const selection = pickExperimentSelection(
          data,
          cachedSelectionRef.current,
        );
        setSelectedProviderId(selection.providerId);
        setSelectedModelId(selection.modelId);
        setSelectedAnalyzerId(selection.analyzerId);
        setSelectedAnalysisModelId(selection.analysisModelId);
      } catch {
        if (cancelled) {
          return;
        }
        configRef.current = null;
        setConfig(null);
        setConfigFailed(true);
        setSelectedModelId("");
        setSelectedAnalyzerId("noop");
        setSelectedAnalysisModelId("");
      }
    }

    async function hydrate() {
      cacheReadyRef.current = false;
      setCacheReady(false);
      await loadConfig();
      if (!cancelled) {
        cacheReadyRef.current = true;
        setCacheReady(true);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [sessionPending]);

  useEffect(() => {
    if (!projectId || !cacheReady) {
      return;
    }

    if (isGenerating || isModifying) {
      return;
    }

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void persist().catch((saveError: unknown) => {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not save project.",
        );
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    projectId,
    cacheReady,
    isGenerating,
    isModifying,
    prompt,
    selectedModelId,
    selectedAnalyzerId,
    selectedAnalysisModelId,
    styleHint,
    resultImages,
    selectedIndex,
    updateText,
    persist,
  ]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    function hideAndSave() {
      void persist(true).catch(() => {
        // Best-effort flush when the tab is hidden or closing.
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hideAndSave();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", hideAndSave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", hideAndSave);
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      void persist(true).catch(() => {
        // Best-effort flush on navigate away.
      });
    };
  }, [persist, projectId]);

  const selectedModel = config?.models.find(
    (model) => model.id === selectedModelId,
  );
  const selectedAnalyzer = config?.analyzers.find(
    (analyzer) => analyzer.id === selectedAnalyzerId,
  );
  const selectedAnalysisModel = config?.analysisModels.find(
    (model) => model.id === selectedAnalysisModelId,
  );
  const imageModelsForProvider = (config?.models ?? []).filter(
    (model) => model.provider === selectedProviderId,
  );
  const analysisModelEnabled = Boolean(selectedAnalyzer?.requiresAnalysisModel);
  const warning = experimentWarning(
    selectedModel,
    selectedAnalyzer,
    selectedAnalysisModel,
    config?.configured ?? null,
    configFailed,
    signedIn,
  );
  const imageProviderConfigured = Boolean(
    selectedModel && config?.configured[selectedModel.provider],
  );
  const analysisProviderConfigured =
    !analysisModelEnabled ||
    Boolean(
      selectedAnalysisModel &&
        config?.configured[selectedAnalysisModel.provider],
    );
  const requestInFlight = isGenerating || isModifying;
  const requestedImageCount = parseRequestedImageCount(imageCount);
  const imageCountOverMax =
    requestedImageCount !== null &&
    requestedImageCount > MAX_GENERATE_IMAGE_COUNT;
  const generateDisabled =
    requestInFlight ||
    !imageProviderConfigured ||
    !analysisProviderConfigured ||
    imageCountOverMax;
  const selectedImage =
    selectedIndex !== null ? resultImages[selectedIndex] : undefined;
  const modifyDisabled =
    updateText.trim().length === 0 ||
    requestInFlight ||
    !imageProviderConfigured ||
    !analysisProviderConfigured;

  const closeInspector = useCallback(() => {
    selectedIndexRef.current = null;
    setSelectedIndex(null);
  }, []);

  function waitForPendingUploads(): Promise<void> {
    if (pendingUploadsRef.current <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = window.setInterval(() => {
        if (pendingUploadsRef.current <= 0) {
          window.clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  function addFiles(fileList: FileList | File[]) {
    void addFilesAsync(fileList);
  }

  async function addFilesAsync(fileList: FileList | File[]) {
    const imageFiles = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      setError("Please choose image files.");
      return;
    }

    const remaining = MAX_PROJECT_EXAMPLES - examplesRef.current.length;
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_PROJECT_EXAMPLES} example images.`);
      return;
    }

    const accepted = imageFiles.slice(0, remaining);
    if (imageFiles.length > remaining) {
      setError(`You can add up to ${MAX_PROJECT_EXAMPLES} example images.`);
    } else {
      setError(null);
    }

    const pending = accepted.map((file) => ({
      id: `local-${crypto.randomUUID()}`,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }));

    setExamples((current) => {
      const next = [...current, ...pending];
      examplesRef.current = next;
      return next;
    });

    const activeProjectId = projectIdRef.current;

    for (const item of pending) {
      pendingUploadsRef.current += 1;
      try {
        const sourceFile = item.file;
        if (!sourceFile) {
          continue;
        }
        const compressed = await compressImageFile(sourceFile);
        if (!examplesRef.current.some((example) => example.id === item.id)) {
          URL.revokeObjectURL(item.previewUrl);
          continue;
        }

        if (!activeProjectId) {
          if (!mountedRef.current) {
            continue;
          }
          setExamples((current) => {
            const next = current.map((example) =>
              example.id === item.id
                ? { ...example, file: compressed }
                : example,
            );
            examplesRef.current = next;
            return next;
          });
          continue;
        }

        const formData = new FormData();
        formData.set("file", compressed);
        const response = await fetch(
          `/api/projects/${activeProjectId}/examples`,
          { method: "POST", body: formData },
        );
        const data = (await response.json()) as {
          example?: StoredExample;
          error?: string;
        };

        if (!response.ok || !data.example) {
          throw new Error(data.error || "Could not save example.");
        }

        if (!examplesRef.current.some((example) => example.id === item.id)) {
          await fetch(
            `/api/projects/${activeProjectId}/examples/${data.example.id}`,
            { method: "DELETE" },
          );
          URL.revokeObjectURL(item.previewUrl);
          continue;
        }

        const saved = data.example;
        URL.revokeObjectURL(item.previewUrl);
        if (!mountedRef.current) {
          continue;
        }
        setExamples((current) => {
          const next = current.map((example) =>
            example.id === item.id
              ? {
                  id: saved.id,
                  file: null,
                  name: saved.name,
                  previewUrl: saved.previewUrl,
                }
              : example,
          );
          examplesRef.current = next;
          return next;
        });
        onSavedRef.current?.();
      } catch (uploadError) {
        URL.revokeObjectURL(item.previewUrl);
        if (!mountedRef.current) {
          continue;
        }
        setExamples((current) => {
          const next = current.filter((example) => example.id !== item.id);
          examplesRef.current = next;
          return next;
        });
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Could not save example.",
        );
      } finally {
        pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current - 1);
      }
    }
  }

  function removeExample(id: string) {
    const removed = examplesRef.current.find((example) => example.id === id);
    setExamples((current) => {
      if (removed?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      const next = current.filter((example) => example.id !== id);
      examplesRef.current = next;
      return next;
    });

    const activeProjectId = projectIdRef.current;
    if (!removed || !activeProjectId || isLocalExampleId(removed.id)) {
      return;
    }

    void fetch(`/api/projects/${activeProjectId}/examples/${removed.id}`, {
      method: "DELETE",
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || "Could not remove example.");
        }
        onSavedRef.current?.();
      })
      .catch((removeError: unknown) => {
        setError(
          removeError instanceof Error
            ? removeError.message
            : "Could not remove example.",
        );
      });
  }

  async function postGenerate(formData: FormData): Promise<{
    images: string[];
    styleHint: string;
  }> {
    if (projectId) {
      formData.set("projectId", projectId);
    }

    const response = await fetch("/api/generate", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as {
      images?: string[];
      styleHint?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }

    if (!data.images?.length) {
      throw new Error("No images were returned.");
    }

    return {
      images: data.images,
      styleHint: data.styleHint ?? "",
    };
  }

  function appendExperimentFields(formData: FormData) {
    formData.set("model", selectedModelId);
    formData.set("analyzer", selectedAnalyzerId);
    formData.set("analysisModel", selectedAnalysisModelId);
    formData.set("count", String(resolveGenerateImageCount(imageCount)));
  }

  async function applyGeneratedResult(result: {
    images: string[];
    styleHint: string;
  }, selectedIndexValue: number | null) {
    const images = await compressResultDataUrls(result.images);
    resultImagesRef.current = images;
    styleHintRef.current = result.styleHint;
    selectedIndexRef.current = selectedIndexValue;
    updateTextRef.current = "";
    setResultImages(images);
    setStyleHint(result.styleHint);
    setSelectedIndex(selectedIndexValue);
    setUpdateText("");
    await persist();
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generateDisabled) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      await waitForPendingUploads();
      const formData = new FormData();
      formData.set("prompt", prompt);
      appendExperimentFields(formData);
      const result = await postGenerate(formData);
      await applyGeneratedResult(result, null);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Something went wrong while generating.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleModify() {
    if (modifyDisabled || selectedIndex === null) {
      return;
    }

    const selectedResult = resultImages[selectedIndex];
    if (!selectedResult) {
      return;
    }

    setIsModifying(true);
    setError(null);

    try {
      await waitForPendingUploads();
      const formData = new FormData();
      formData.set("prompt", updateText.trim());
      appendExperimentFields(formData);
      formData.set(
        "source",
        await dataUrlToFile(selectedResult, `meme-${selectedIndex + 1}.jpg`),
      );
      const result = await postGenerate(formData);
      await applyGeneratedResult(result, 0);
    } catch (modifyError) {
      setError(
        modifyError instanceof Error
          ? modifyError.message
          : "Something went wrong while generating.",
      );
    } finally {
      setIsModifying(false);
    }
  }

  function toggleResult(index: number) {
    setSelectedIndex((current) => {
      const next = current === index ? null : index;
      selectedIndexRef.current = next;
      return next;
    });
  }

  const layoutClass = selectedImage
    ? "grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]"
    : undefined;
  const formClass = selectedImage
    ? "grid gap-6 lg:col-span-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
    : "grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]";

  return (
    <div className={layoutClass}>
      <form onSubmit={handleGenerate} className={formClass}>
        <section className="rounded-2xl border-2 border-panel-edge bg-panel p-5 shadow-[8px_8px_0_#0a0806]">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl tracking-wide text-accent">
                Example images
              </h2>
            </div>
            <span className="rounded-full border border-panel-edge px-3 py-1 text-xs uppercase tracking-widest text-muted">
              {examples.length} added
            </span>
          </div>

          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              if (event.dataTransfer.files.length > 0) {
                addFiles(event.dataTransfer.files);
              }
            }}
            className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragging
                ? "border-accent bg-accent/10"
                : "border-panel-edge hover:border-accent/70 hover:bg-white/5"
            }`}
          >
            <span className="font-display text-xl tracking-wide">
              Drop images here
            </span>
            <span className="mt-2 text-sm text-muted">
              or click to browse PNG, JPG, WebP, or GIF files
            </span>
            <input
              ref={inputRef}
              id={inputId}
              name="examples"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(event.target.files);
                  event.target.value = "";
                }
              }}
            />
          </label>

          <FeedImport
            projectId={projectId}
            remaining={MAX_PROJECT_EXAMPLES - examples.length}
            disabled={requestInFlight}
            onError={setError}
            onImported={(saved) => {
              setError(null);
              setExamples((current) => {
                const next = [
                  ...current,
                  ...saved.map((example) => ({
                    id: example.id,
                    file: null,
                    name: example.name,
                    previewUrl: example.previewUrl,
                  })),
                ];
                examplesRef.current = next;
                return next;
              });
              onSavedRef.current?.();
            }}
          />

          {examples.length > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {examples.map((example) => (
                <li
                  key={example.id}
                  className="group relative overflow-hidden rounded-lg border-2 border-panel-edge bg-black"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={example.previewUrl}
                    alt={example.name}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExample(example.id)}
                    className="absolute right-2 top-2 rounded-full bg-black/80 px-2 py-1 text-xs uppercase tracking-wide text-accent opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border-2 border-panel-edge bg-panel p-5 shadow-[8px_8px_0_#0a0806]">
            <label htmlFor={promptId} className="block">
              <span className="font-display text-2xl tracking-wide text-accent">
                Prompt
              </span>
            </label>
            <textarea
              id={promptId}
              name="prompt"
              value={prompt}
              onChange={(event) => {
                promptRef.current = event.target.value;
                setPrompt(event.target.value);
              }}
              rows={7}
              placeholder="A confused dog at a whiteboard, same grainy caption style as the examples..."
              className="mt-4 w-full resize-y rounded-xl border-2 border-panel-edge bg-background px-4 py-3 text-base leading-6 text-foreground outline-none placeholder:text-muted/70 focus:border-accent"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label htmlFor={providerFieldId} className="block">
                <span className="text-sm font-medium text-foreground">
                  Provider
                </span>
                <select
                  id={providerFieldId}
                  name="provider"
                  value={selectedProviderId}
                  onChange={(event) => {
                    const provider = event.target.value as ProviderId;
                    setSelectedProviderId(provider);
                    const nextModels = (config?.models ?? []).filter(
                      (model) => model.provider === provider,
                    );
                    if (
                      !nextModels.some((model) => model.id === selectedModelId)
                    ) {
                      const nextModelId = nextModels[0]?.id ?? "";
                      modelIdRef.current = nextModelId;
                      setSelectedModelId(nextModelId);
                    }
                  }}
                  disabled={!config?.models.length}
                  className={SELECT_CLASS}
                >
                  {PROVIDERS.map((provider) => (
                    <option
                      key={provider}
                      value={provider}
                      disabled={!config?.configured[provider]}
                    >
                      {PROVIDER_LABELS[provider]}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor={imageModelId} className="block">
                <span className="text-sm font-medium text-foreground">
                  Image model
                </span>
                <select
                  id={imageModelId}
                  name="model"
                  value={selectedModelId}
                  onChange={(event) => {
                    modelIdRef.current = event.target.value;
                    setSelectedModelId(event.target.value);
                  }}
                  disabled={!imageModelsForProvider.length}
                  className={SELECT_CLASS}
                >
                  {imageModelsForProvider.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor={analyzerFieldId} className="block">
                <span className="text-sm font-medium text-foreground">
                  Analyzer
                </span>
                <select
                  id={analyzerFieldId}
                  name="analyzer"
                  value={selectedAnalyzerId}
                  onChange={(event) => {
                    analyzerIdRef.current = event.target.value;
                    setSelectedAnalyzerId(event.target.value);
                  }}
                  disabled={!config?.analyzers.length}
                  className={SELECT_CLASS}
                >
                  {(config?.analyzers ?? []).map((analyzer) => (
                    <option key={analyzer.id} value={analyzer.id}>
                      {analyzer.label}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor={analysisModelFieldId} className="block">
                <span className="text-sm font-medium text-foreground">
                  Analysis model
                </span>
                <select
                  id={analysisModelFieldId}
                  name="analysisModel"
                  value={selectedAnalysisModelId}
                  onChange={(event) => {
                    analysisModelIdRef.current = event.target.value;
                    setSelectedAnalysisModelId(event.target.value);
                  }}
                  disabled={
                    !analysisModelEnabled ||
                    !(config?.analysisModels ?? []).some(
                      (model) => config?.configured[model.provider],
                    )
                  }
                  className={SELECT_CLASS}
                >
                  {(config?.analysisModels ?? []).map((model) => {
                    const modelConfigured = Boolean(
                      config?.configured[model.provider],
                    );
                    return (
                      <option
                        key={model.id}
                        value={model.id}
                        disabled={!modelConfigured}
                      >
                        {model.label}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label htmlFor={imageCountFieldId} className="block">
                <span className="text-sm font-medium text-foreground">
                  Images
                </span>
                <input
                  id={imageCountFieldId}
                  name="count"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={imageCount}
                  onChange={(event) => {
                    setImageCount(event.target.value);
                  }}
                  className={SELECT_CLASS}
                />
              </label>
            </div>

            {imageCountOverMax ? (
              <p className="mt-3 text-sm text-amber-300" role="status">
                The program can only generate {MAX_GENERATE_IMAGE_COUNT} at a time.
              </p>
            ) : null}

            {warning && (
              <p className="mt-3 text-sm text-amber-300" role="status">
                {warning}
              </p>
            )}

            <button
              type="submit"
              disabled={generateDisabled}
              className="mt-4 w-full rounded-xl bg-accent px-5 py-3 font-display text-xl tracking-wide text-accent-ink transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isModifying
                ? "Modifying..."
                : isGenerating
                  ? "Generating..."
                  : "Generate image"}
            </button>
          </section>

          <section className="flex-1 rounded-2xl border-2 border-panel-edge bg-panel p-5 shadow-[8px_8px_0_#0a0806]">
            <h2 className="font-display text-2xl tracking-wide text-accent">
              Result
            </h2>
            <p className="mt-1 text-sm text-muted">
              Generated images will show up here.
            </p>
            <div className="mt-4 min-h-32 rounded-xl border-2 border-dashed border-panel-edge bg-background px-4 py-6">
              {error ? (
                <p className="text-sm text-red-300">{error}</p>
              ) : null}
              {resultImages.length > 0 ? (
                <ul
                  className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${error ? "mt-4" : ""}`}
                >
                  {resultImages.map((image, index) => {
                    const selected = selectedIndex === index;
                    return (
                      <li key={`${index}-${image.slice(0, 32)}`}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleResult(index)}
                          className={`w-full overflow-hidden rounded-lg border-2 bg-black ${
                            selected
                              ? "border-accent ring-2 ring-accent"
                              : "border-panel-edge"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt={`Generated meme ${index + 1}`}
                            className="aspect-square w-full object-cover"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : error || !cacheReady ? null : (
                <p className="text-sm text-muted">
                  Upload examples, write a prompt, then hit generate.
                </p>
              )}
            </div>
          </section>
        </div>
      </form>

      {selectedImage && selectedIndex !== null && (
        <ResultInspector
          image={selectedImage}
          index={selectedIndex}
          updateText={updateText}
          onUpdateTextChange={(value) => {
            updateTextRef.current = value;
            setUpdateText(value);
          }}
          onModify={() => {
            void handleModify();
          }}
          onClose={closeInspector}
          isModifying={isModifying}
          modifyDisabled={modifyDisabled}
        />
      )}
    </div>
  );
}
