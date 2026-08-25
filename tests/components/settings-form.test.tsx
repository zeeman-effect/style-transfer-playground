// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/app/settings/settings-form";

describe("SettingsForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("requires an API key before saving", async () => {
    const user = userEvent.setup();
    render(<SettingsForm saved={{ google: false, openai: false }} />);

    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(screen.getByText("API key is required.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("saves a key, shows saved, and clears the input", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<SettingsForm saved={{ google: false, openai: false }} />);
    const google = screen.getByLabelText(/Google Gemini/);
    await user.type(google, "sk-test");
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/account/keys",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ provider: "google", key: "sk-test" }),
        }),
      );
    });

    const section = screen.getByText("Google Gemini").closest("div");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText("saved")).toBeInTheDocument();
    expect(google).toHaveValue("");
  });

  it("removes a saved key with DELETE", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<SettingsForm saved={{ google: true, openai: false }} />);
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/account/keys",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ provider: "google" }),
        }),
      );
    });

    const section = screen.getByText("Google Gemini").closest("div");
    expect(within(section as HTMLElement).getByText("empty")).toBeInTheDocument();
  });

  it("shows a fetch error message", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Could not save API key." }),
    } as Response);

    render(<SettingsForm saved={{ google: false, openai: false }} />);
    await user.type(screen.getByLabelText(/Google Gemini/), "sk-test");
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);

    expect(
      await screen.findByText("Could not save API key."),
    ).toBeInTheDocument();
  });
});
