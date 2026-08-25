// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectMenu } from "@/components/project-menu";
import type { ProjectSummary } from "@/lib/generation/types";

const projects: ProjectSummary[] = [
  { id: "a", name: "Alpha", updatedAt: 1 },
  { id: "b", name: "Beta", updatedAt: 2 },
];

function renderMenu(
  overrides: Partial<Parameters<typeof ProjectMenu>[0]> = {},
) {
  const props = {
    projects,
    selectedId: "a",
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<ProjectMenu {...props} />);
  return props;
}

afterEach(cleanup);

describe("ProjectMenu", () => {
  it("opens the menu and creates a project", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByRole("button", { name: "Alpha" }));
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New" }));
    expect(props.onCreate).toHaveBeenCalled();
  });

  it("selects another project", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Beta" }));
    expect(props.onSelect).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("button", { name: "New" })).not.toBeInTheDocument();
  });

  it("renames the selected project on blur", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByRole("button", { name: "Alpha" }));
    const name = screen.getByLabelText("Project name");
    await user.clear(name);
    await user.type(name, "Alpha Two");
    await user.tab();
    expect(props.onRename).toHaveBeenCalledWith("a", "Alpha Two");
  });

  it("deletes when confirm is true and skips when false", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByRole("button", { name: "Alpha" }));

    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Delete Alpha" }));
    expect(props.onDelete).not.toHaveBeenCalled();

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Delete Alpha" }));
    expect(props.onDelete).toHaveBeenCalledWith("a");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Alpha" }));
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "New" })).not.toBeInTheDocument();
  });
});
