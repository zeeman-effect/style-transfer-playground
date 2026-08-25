import { beforeEach, describe, expect, it, vi } from "vitest";
import { countProjectExamples, createProjectExample } from "@/lib/account/examples";
import { ExampleLimitError } from "@/lib/account/errors";
import { getProject } from "@/lib/account/projects";
import { downloadFeedImage } from "@/lib/feeds/download";
import { FeedError } from "@/lib/feeds/errors";
import { importFeedExamples } from "@/lib/feeds/import";
import { listXFeedImages } from "@/lib/feeds/x";
import { MAX_FEED_IMPORT, MAX_PROJECT_EXAMPLES } from "@/lib/images/constants";
import { makeFile } from "../../helpers";

vi.mock("@/lib/account/projects", () => ({
  getProject: vi.fn(),
}));
vi.mock("@/lib/account/examples", () => ({
  countProjectExamples: vi.fn(),
  createProjectExample: vi.fn(),
}));
vi.mock("@/lib/feeds/download", () => ({
  downloadFeedImage: vi.fn(),
}));
vi.mock("@/lib/feeds/x", () => ({
  listXFeedImages: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const countProjectExamplesMock = vi.mocked(countProjectExamples);
const createProjectExampleMock = vi.mocked(createProjectExample);
const downloadFeedImageMock = vi.mocked(downloadFeedImage);
const listXFeedImagesMock = vi.mocked(listXFeedImages);

describe("importFeedExamples", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectMock.mockResolvedValue({ id: "proj" } as never);
    countProjectExamplesMock.mockResolvedValue(0);
    createProjectExampleMock.mockImplementation(async (_user, _project, file) => ({
      id: file.name,
      name: file.name,
      kind: "upload",
      previewUrl: `/examples/${file.name}`,
    }));
    downloadFeedImageMock.mockImplementation(async (ref) =>
      makeFile(ref.name),
    );
  });

  it("throws when the project is already at the example cap", async () => {
    countProjectExamplesMock.mockResolvedValue(MAX_PROJECT_EXAMPLES);
    await expect(
      importFeedExamples("u1", "p1", {
        source: "@acct",
        platform: "x",
        count: 2,
      }),
    ).rejects.toBeInstanceOf(ExampleLimitError);
    expect(listXFeedImagesMock).not.toHaveBeenCalled();
  });

  it("rejects a non-positive count", async () => {
    await expect(
      importFeedExamples("u1", "p1", {
        source: "@acct",
        platform: "x",
        count: 0,
      }),
    ).rejects.toThrow("Image count must be a positive integer.");
  });

  it("requires Instagram posts and fails when none resolve", async () => {
    await expect(
      importFeedExamples("u1", "p1", {
        source: "@acct",
        platform: "instagram",
      }),
    ).rejects.toMatchObject({
      message: "Instagram posts are required.",
      status: 400,
    });
  });

  it("imports Instagram CDN images up to the remaining slots", async () => {
    countProjectExamplesMock.mockResolvedValue(MAX_PROJECT_EXAMPLES - 1);
    const result = await importFeedExamples("u1", "p1", {
      source: "@acct",
      platform: "instagram",
      count: 8,
      instagramShortcodes: ["CodeOne", "CodeTwo"],
      instagramImageUrls: [
        "https://scontent.cdninstagram.com/one.jpg",
        "https://scontent.cdninstagram.com/two.jpg",
      ],
    });
    expect(result.examples).toHaveLength(1);
    expect(downloadFeedImageMock).toHaveBeenCalledOnce();
    expect(createProjectExampleMock).toHaveBeenCalledOnce();
  });

  it("clamps X imports to MAX_FEED_IMPORT", async () => {
    listXFeedImagesMock.mockResolvedValue(
      Array.from({ length: MAX_FEED_IMPORT }, (_, index) => ({
        url: `https://pbs.twimg.com/${index}.jpg`,
        name: `acct_${index}.jpg`,
      })),
    );
    const result = await importFeedExamples("u1", "p1", {
      source: "@acct",
      platform: "x",
      count: 99,
    });
    expect(listXFeedImagesMock).toHaveBeenCalledWith("acct", MAX_FEED_IMPORT);
    expect(result.examples).toHaveLength(MAX_FEED_IMPORT);
  });

  it("throws when every download fails", async () => {
    listXFeedImagesMock.mockResolvedValue([
      { url: "https://pbs.twimg.com/a.jpg", name: "a.jpg" },
    ]);
    downloadFeedImageMock.mockRejectedValue(new Error("network"));
    await expect(
      importFeedExamples("u1", "p1", {
        source: "@acct",
        platform: "x",
        count: 1,
      }),
    ).rejects.toMatchObject({
      name: "FeedError",
      status: 502,
    });
  });

  it("rethrows a FeedError from download when nothing was saved", async () => {
    listXFeedImagesMock.mockResolvedValue([
      { url: "https://pbs.twimg.com/a.jpg", name: "a.jpg" },
    ]);
    downloadFeedImageMock.mockRejectedValue(new FeedError("blocked", 400));
    await expect(
      importFeedExamples("u1", "p1", {
        source: "@acct",
        platform: "x",
        count: 1,
      }),
    ).rejects.toMatchObject({ message: "blocked", status: 400 });
  });

  it("throws when the X feed lists no images", async () => {
    listXFeedImagesMock.mockResolvedValue([]);
    await expect(
      importFeedExamples("u1", "p1", {
        source: "@acct",
        platform: "x",
        count: 2,
      }),
    ).rejects.toThrow("No images found on that feed.");
  });
});
