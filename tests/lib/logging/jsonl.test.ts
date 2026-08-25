import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendJsonl,
  tryAppendJsonl,
  tryWriteJsonFile,
  writeJsonFile,
} from "@/lib/logging/jsonl";

const fsMocks = vi.hoisted(() => ({
  appendFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  ...fsMocks,
  default: fsMocks,
}));

describe("jsonl writers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMocks.appendFile.mockResolvedValue(undefined);
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.writeFile.mockResolvedValue(undefined);
  });

  it("creates the parent dir and appends redacted JSON", async () => {
    await appendJsonl("/tmp/logs/run.jsonl", { apiKey: "secret", ok: true });
    expect(fsMocks.mkdir).toHaveBeenCalledWith("/tmp/logs", { recursive: true });
    const payload = fsMocks.appendFile.mock.calls[0][1] as string;
    expect(payload).toContain("[REDACTED]");
    expect(payload).not.toContain("secret");
    expect(payload.endsWith("\n")).toBe(true);
  });

  it("pretty-writes JSON files", async () => {
    await writeJsonFile("/tmp/logs/meta.json", { keep: 1 });
    const payload = fsMocks.writeFile.mock.calls[0][1] as string;
    expect(payload).toContain("\n");
    expect(payload).toContain('"keep": 1');
  });

  it("swallows failures in try* helpers", async () => {
    fsMocks.appendFile.mockRejectedValue(new Error("disk"));
    fsMocks.writeFile.mockRejectedValue(new Error("disk"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      tryAppendJsonl("append", "/tmp/x.jsonl", { a: 1 }),
    ).resolves.toBeUndefined();
    await expect(
      tryWriteJsonFile("write", "/tmp/x.json", { a: 1 }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
