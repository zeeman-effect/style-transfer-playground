// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationBatchList } from "@/components/generation-batch-list";
import type {
  AnalyzerCatalogEntry,
  GenerationModel,
  ProjectGeneration,
} from "@/lib/generation/types";

const analyzers: AnalyzerCatalogEntry[] = [
  {
    id: "deep",
    label: "Deep",
    requiresAnalysisModel: true,
    summary: "vision",
  },
  {
    id: "noop",
    label: "No-op",
    requiresAnalysisModel: false,
    summary: "skip",
  },
];

const models: GenerationModel[] = [
  { id: "gemini", label: "Gemini", provider: "google" },
];

const analysisModels: GenerationModel[] = [
  { id: "gpt", label: "GPT-4o", provider: "openai" },
];

const generations: ProjectGeneration[] = [
  {
    id: "g1",
    createdAt: 1_700_000_000_000,
    prompt: "hello",
    modelId: "gemini",
    analyzerId: "deep",
    analysisModelId: "gpt",
    styleHint: "",
    parentGenerationId: null,
    images: [{ id: "img1", url: "https://example.com/1.jpg" }],
  },
  {
    id: "g2",
    createdAt: 1_700_000_001_000,
    prompt: "hello",
    modelId: "gemini",
    analyzerId: "noop",
    analysisModelId: null,
    styleHint: "",
    parentGenerationId: "g1",
    images: [{ id: "img2", url: "https://example.com/2.jpg" }],
  },
];

afterEach(cleanup);

describe("GenerationBatchList", () => {
  it("renders catalog titles, Modified badge, and handles select/delete", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    render(
      <GenerationBatchList
        generations={generations}
        selectedGenerationId={null}
        selectedIndex={null}
        analyzers={analyzers}
        models={models}
        analysisModels={analysisModels}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Deep · Gemini · GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("No-op · Gemini")).toBeInTheDocument();
    expect(screen.getByText("Modified")).toBeInTheDocument();

    await user.click(screen.getAllByAltText("Generated meme 1")[0]);
    expect(onSelect).toHaveBeenCalledWith("g1", 0);

    await user.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    expect(onDelete).toHaveBeenCalledWith("g2");
  });
});
