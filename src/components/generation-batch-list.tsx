"use client";

import type {
  AnalyzerCatalogEntry,
  GenerationModel,
  ProjectGeneration,
} from "@/lib/generation/types";

type GenerationBatchListProps = {
  generations: ProjectGeneration[];
  selectedGenerationId: string | null;
  selectedIndex: number | null;
  analyzers: AnalyzerCatalogEntry[];
  models: GenerationModel[];
  analysisModels: GenerationModel[];
  onSelect: (generationId: string, index: number) => void;
  onDelete: (generationId: string) => void;
  deleteDisabled?: boolean;
  compact?: boolean;
};

function catalogLabel(
  id: string,
  entries: Array<{ id: string; label: string }>,
): string {
  return entries.find((entry) => entry.id === id)?.label ?? id;
}

function formatTimestamp(createdAt: number): string {
  return new Date(createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function batchTitle(
  generation: ProjectGeneration,
  analyzers: AnalyzerCatalogEntry[],
  models: GenerationModel[],
  analysisModels: GenerationModel[],
): string {
  const analyzer = analyzers.find((entry) => entry.id === generation.analyzerId);
  const parts = [
    catalogLabel(generation.analyzerId, analyzers),
    catalogLabel(generation.modelId, models),
  ];
  const analysisUnused =
    analyzer !== undefined && !analyzer.requiresAnalysisModel;
  if (generation.analysisModelId && !analysisUnused) {
    parts.push(catalogLabel(generation.analysisModelId, analysisModels));
  }
  return parts.join(" · ");
}

export function GenerationBatchList({
  generations,
  selectedGenerationId,
  selectedIndex,
  analyzers,
  models,
  analysisModels,
  onSelect,
  onDelete,
  deleteDisabled = false,
  compact = false,
}: GenerationBatchListProps) {
  return (
    <ul className="grid gap-4">
      {generations.map((generation) => (
        <li
          key={generation.id}
          className={`rounded-xl border border-panel-edge bg-background ${
            compact ? "p-2" : "p-3"
          }`}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {batchTitle(generation, analyzers, models, analysisModels)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {generation.parentGenerationId ? (
                  <span className="rounded-xl border border-panel-edge px-2 py-0.5 text-xs uppercase tracking-widest text-muted">
                    Modified
                  </span>
                ) : null}
                <time
                  className="text-xs text-muted"
                  dateTime={new Date(generation.createdAt).toISOString()}
                >
                  {formatTimestamp(generation.createdAt)}
                </time>
              </div>
            </div>
            <button
              type="button"
              disabled={deleteDisabled}
              onClick={() => onDelete(generation.id)}
              className="rounded-xl border border-panel-edge bg-background/80 px-2 py-1 text-xs uppercase tracking-wide text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
          </div>
          <ul
            className={`grid gap-2 ${
              compact
                ? "grid-cols-3 sm:grid-cols-4"
                : "grid-cols-2 gap-3 sm:grid-cols-3"
            }`}
          >
            {generation.images.map((image, index) => {
              const selected =
                selectedGenerationId === generation.id &&
                selectedIndex === index;
              return (
                <li key={image.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(generation.id, index)}
                    className={`w-full overflow-hidden rounded-lg border bg-background ${
                      selected
                        ? "border-accent ring-1 ring-accent/60"
                        : "border-panel-edge"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={`Generated meme ${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
