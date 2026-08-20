import sharp from "sharp";
import {
  COMPRESS_MAX_BYTES,
  COMPRESS_MAX_EDGE,
  COMPRESS_MIN_EDGE,
  COMPRESS_MIN_QUALITY,
  COMPRESS_QUALITY_STEP,
  COMPRESS_START_QUALITY,
} from "@/lib/images/constants";

function toJpegFilename(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.replace(/\.[^.]+$/, "") || "image";
  return `${base}.jpg`;
}

function scaleToMaxEdge(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function compressImageBytes(
  input: Buffer,
  filename: string,
): Promise<File> {
  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  let width = meta.width ?? COMPRESS_MAX_EDGE;
  let height = meta.height ?? COMPRESS_MAX_EDGE;
  ({ width, height } = scaleToMaxEdge(width, height, COMPRESS_MAX_EDGE));

  let quality = Math.round(COMPRESS_START_QUALITY * 100);
  const minQuality = Math.round(COMPRESS_MIN_QUALITY * 100);
  const step = Math.round(COMPRESS_QUALITY_STEP * 100);

  async function encode(nextWidth: number, nextHeight: number, nextQuality: number) {
    return sharp(input, { failOn: "none" })
      .rotate()
      .resize(nextWidth, nextHeight)
      .jpeg({ quality: nextQuality })
      .toBuffer();
  }

  let jpeg = await encode(width, height, quality);
  while (jpeg.byteLength > COMPRESS_MAX_BYTES && quality > minQuality) {
    quality = Math.max(minQuality, quality - step);
    jpeg = await encode(width, height, quality);
  }

  while (
    jpeg.byteLength > COMPRESS_MAX_BYTES &&
    Math.max(width, height) > COMPRESS_MIN_EDGE
  ) {
    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
    jpeg = await encode(width, height, minQuality);
  }

  return new File([new Uint8Array(jpeg)], toJpegFilename(filename), {
    type: "image/jpeg",
  });
}
