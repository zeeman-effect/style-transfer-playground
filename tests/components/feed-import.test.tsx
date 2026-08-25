// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedImport } from "@/components/feed-import";
import { IG_WINDOW_NAME } from "@/lib/feeds/instagram-import-client";
import type { StoredExample } from "@/lib/generation/types";

const example: StoredExample = {
  id: "ex-1",
  name: "photo.jpg",
  kind: "upload",
  previewUrl: "https://example.com/photo.jpg",
};

describe("FeedImport", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(window, "open").mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("disables Pull without a source", () => {
    render(
      <FeedImport
        projectId="proj-1"
        remaining={8}
        onImported={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Pull" })).toBeDisabled();
  });

  it("disables Pull when remaining is 0", async () => {
    const user = userEvent.setup();
    render(
      <FeedImport
        projectId="proj-1"
        remaining={0}
        onImported={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Profile"), "@catmemes");
    expect(screen.getByRole("button", { name: "Pull" })).toBeDisabled();
  });

  it("disables Pull and shows status when count is over max", () => {
    render(
      <FeedImport
        projectId="proj-1"
        remaining={3}
        onImported={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "You can pull up to 3 images.",
    );
    expect(screen.getByRole("button", { name: "Pull" })).toBeDisabled();
  });

  it("POSTs an X feed and calls onImported", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ examples: [example] }),
    } as Response);

    render(
      <FeedImport
        projectId="proj-1"
        remaining={8}
        onImported={onImported}
        onError={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Source"), "x");
    await user.type(screen.getByLabelText("Profile"), "@catmemes");
    await user.click(screen.getByRole("button", { name: "Pull" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/proj-1/example-feed",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            source: "@catmemes",
            platform: "x",
            count: 8,
          }),
        }),
      );
    });
    expect(onImported).toHaveBeenCalledWith([example]);
  });

  it("asks the user to sign in when there is no projectId", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();

    render(
      <FeedImport remaining={8} onImported={vi.fn()} onError={onError} />,
    );
    await user.type(screen.getByLabelText("Profile"), "@catmemes");
    await user.click(screen.getByRole("button", { name: "Pull" }));

    expect(onError).toHaveBeenCalledWith("Sign in to pull images from a feed.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches an Instagram ticket and opens the profile", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/feed-import/ticket")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ token: "tok-1" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: "pending", examples: [] }),
      } as Response);
    });

    render(
      <FeedImport
        projectId="proj-1"
        remaining={8}
        onImported={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Profile"), "@catmemes");
    await user.click(screen.getByRole("button", { name: "Pull" }));

    expect(window.open).toHaveBeenCalledWith(
      "https://www.instagram.com/catmemes/",
      IG_WINDOW_NAME,
    );
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/feed-import/ticket",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            projectId: "proj-1",
            source: "@catmemes",
            count: 8,
          }),
        }),
      );
    });
  });
});
