import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildCompositeImage } from "@/lib/generation/style/composite-image";

async function pngFile(name = "px.png") {
  const png = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(png)], name, { type: "image/png" });
}

describe("buildCompositeImage", () => {
  it("returns null for empty or invalid sources", async () => {
    expect(await buildCompositeImage([])).toBeNull();
    expect(
      await buildCompositeImage([
        new File([], "empty.png", { type: "image/png" }),
      ]),
    ).toBeNull();
    expect(
      await buildCompositeImage([
        new File([new Uint8Array([1, 2, 3])], "bad.png", { type: "image/png" }),
      ]),
    ).toBeNull();
  });

  it("returns a jpeg File for a valid 1x1 PNG", async () => {
    const file = await pngFile();
    const composite = await buildCompositeImage([file]);
    expect(composite).toBeInstanceOf(File);
    expect(composite?.type).toBe("image/jpeg");
    expect(composite?.name).toBe("composite.jpg");
    expect(composite && composite.size > 0).toBe(true);
    const meta = await sharp(Buffer.from(await composite!.arrayBuffer())).metadata();
    expect(meta.format).toBe("jpeg");
  });
});
