// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AnalyzerHelp } from "@/components/analyzer-help";
import { STYLE_ANALYZERS } from "@/lib/generation/style/catalog";

afterEach(cleanup);

describe("AnalyzerHelp", () => {
  beforeAll(() => {
    if (typeof HTMLDialogElement === "undefined") {
      return;
    }
    if (typeof HTMLDialogElement.prototype.showModal !== "function") {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute("open", "");
      };
    }
    if (typeof HTMLDialogElement.prototype.close !== "function") {
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute("open");
      };
    }
  });

  it("exposes a help button and lists analyzer labels and summaries", async () => {
    const user = userEvent.setup();
    const showModal = vi
      .spyOn(HTMLDialogElement.prototype, "showModal")
      .mockImplementation(function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      });

    render(<AnalyzerHelp />);

    const help = screen.getByRole("button", { name: "How analyzers work" });
    expect(help).toHaveAttribute("aria-label", "How analyzers work");

    for (const analyzer of STYLE_ANALYZERS) {
      expect(screen.getByText(analyzer.label)).toBeInTheDocument();
      expect(screen.getByText(analyzer.summary)).toBeInTheDocument();
    }

    await user.click(help);
    expect(showModal).toHaveBeenCalled();
    showModal.mockRestore();
  });
});
