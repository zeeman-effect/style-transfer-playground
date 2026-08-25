// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProjectChromeProvider,
  useProjectChrome,
  useRegisterProjectChrome,
  type ProjectChrome,
} from "@/components/project-chrome";

const chrome: ProjectChrome = {
  projects: [{ id: "proj-1", name: "First", updatedAt: 1 }],
  selectedId: "proj-1",
  onSelect: vi.fn(),
  onCreate: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
};

function Probe() {
  const value = useProjectChrome();
  return <div>{value?.selectedId ?? "none"}</div>;
}

function Register({ value }: { value: ProjectChrome | null }) {
  useRegisterProjectChrome(value);
  return null;
}

afterEach(cleanup);

describe("project-chrome", () => {
  it("registers chrome and exposes it through the provider", async () => {
    render(
      <ProjectChromeProvider>
        <Register value={chrome} />
        <Probe />
      </ProjectChromeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("proj-1")).toBeInTheDocument();
    });
  });
});
