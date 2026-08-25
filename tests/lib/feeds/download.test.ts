import { compressImageBytes } from "@/lib/images/compress-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedError } from "@/lib/feeds/errors";
import { downloadFeedImage } from "@/lib/feeds/download";

vi.mock("@/lib/images/compress-server", () => ({
  compressImageBytes: vi.fn(async (_bytes: Buffer, name: string) => {
    return new File([new Uint8Array([1])], name, { type: "image/jpeg" });
  }),
}));

const compressMock = vi.mocked(compressImageBytes);

const ALLOWED_URL = "https://pbs.twimg.com/media/example.jpg";
const MAX_DOWNLOAD_BYTES = 8_000_000;

function jpegBytes(size = 16): Buffer {
  const bytes = Buffer.alloc(size, 0);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  return bytes;
}

function fetchResponse(init: {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: Buffer;
}): Response {
  const body = init.body ?? jpegBytes();
  const copy = Uint8Array.from(body);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers),
    arrayBuffer: async () => copy.buffer,
  } as Response;
}

describe("downloadFeedImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects http URLs", async () => {
    await expect(
      downloadFeedImage({ url: "http://pbs.twimg.com/media/x.jpg", name: "x.jpg" }),
    ).rejects.toMatchObject({ name: "FeedError", status: 502 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects off-allowlist hosts including localhost", async () => {
    await expect(
      downloadFeedImage({ url: "https://localhost/secret.jpg", name: "x.jpg" }),
    ).rejects.toBeInstanceOf(FeedError);
    await expect(
      downloadFeedImage({ url: "https://127.0.0.1/secret.jpg", name: "x.jpg" }),
    ).rejects.toBeInstanceOf(FeedError);
    await expect(
      downloadFeedImage({
        url: "https://evil.example/pbs.twimg.com/x.jpg",
        name: "x.jpg",
      }),
    ).rejects.toBeInstanceOf(FeedError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an image advertised as larger than 8MB", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fetchResponse({
        headers: { "content-length": String(MAX_DOWNLOAD_BYTES + 1) },
      }),
    );
    await expect(
      downloadFeedImage({ url: ALLOWED_URL, name: "x.jpg" }),
    ).rejects.toMatchObject({
      name: "FeedError",
      message: "An image from that feed was too large.",
      status: 400,
    });
    expect(compressMock).not.toHaveBeenCalled();
  });

  it("rejects a body larger than 8MB", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fetchResponse({ body: jpegBytes(MAX_DOWNLOAD_BYTES + 1) }),
    );
    await expect(
      downloadFeedImage({ url: ALLOWED_URL, name: "x.jpg" }),
    ).rejects.toMatchObject({
      name: "FeedError",
      status: 400,
    });
    expect(compressMock).not.toHaveBeenCalled();
  });

  it("rejects HTML and JSON responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fetchResponse({
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    await expect(
      downloadFeedImage({ url: ALLOWED_URL, name: "x.jpg" }),
    ).rejects.toBeInstanceOf(FeedError);

    vi.mocked(fetch).mockResolvedValueOnce(
      fetchResponse({
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      downloadFeedImage({ url: ALLOWED_URL, name: "x.jpg" }),
    ).rejects.toBeInstanceOf(FeedError);
    expect(compressMock).not.toHaveBeenCalled();
  });

  it("rejects a non-image body even with an image content-type", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fetchResponse({
        headers: { "content-type": "image/jpeg" },
        body: Buffer.from("not-an-image-body!!"),
      }),
    );
    await expect(
      downloadFeedImage({ url: ALLOWED_URL, name: "x.jpg" }),
    ).rejects.toBeInstanceOf(FeedError);
    expect(compressMock).not.toHaveBeenCalled();
  });

  it("downloads an allowlisted https image and compresses it", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fetchResponse({
        headers: { "content-type": "image/jpeg" },
        body: jpegBytes(),
      }),
    );
    const file = await downloadFeedImage({ url: ALLOWED_URL, name: "shot.jpg" });
    expect(file.name).toBe("shot.jpg");
    expect(compressMock).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      new URL(ALLOWED_URL),
      expect.objectContaining({ redirect: "follow" }),
    );
  });
});
