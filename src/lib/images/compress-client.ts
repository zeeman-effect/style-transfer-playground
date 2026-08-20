import {
  COMPRESS_MAX_BYTES,
  COMPRESS_MAX_EDGE,
  COMPRESS_MIN_EDGE,
  COMPRESS_MIN_QUALITY,
  COMPRESS_QUALITY_STEP,
  COMPRESS_START_QUALITY,
  MAX_RESULT_DATA_URL_CHARS,
} from "@/lib/images/constants";

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

function toJpegFilename(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.replace(/\.[^.]+$/, "") || "image";
  return `${base}.jpg`;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function encodeJpegUnderMaxBytes(
  bitmap: ImageBitmap,
  maxBytes: number,
  maxEdge: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not compress image.");
  }

  let { width, height } = scaleToMaxEdge(bitmap.width, bitmap.height, maxEdge);
  canvas.width = width;
  canvas.height = height;
  context.drawImage(bitmap, 0, 0, width, height);

  let quality = COMPRESS_START_QUALITY;
  let blob = await canvasToJpegBlob(canvas, quality);
  while (blob.size > maxBytes && quality > COMPRESS_MIN_QUALITY) {
    quality = Math.max(COMPRESS_MIN_QUALITY, quality - COMPRESS_QUALITY_STEP);
    blob = await canvasToJpegBlob(canvas, quality);
  }

  while (
    blob.size > maxBytes &&
    Math.max(width, height) > COMPRESS_MIN_EDGE
  ) {
    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await canvasToJpegBlob(canvas, COMPRESS_MIN_QUALITY);
  }

  return blob;
}

export async function compressImageFile(
  file: File,
  options?: { maxBytes?: number; maxEdge?: number },
): Promise<File> {
  const maxBytes = options?.maxBytes ?? COMPRESS_MAX_BYTES;
  const maxEdge = options?.maxEdge ?? COMPRESS_MAX_EDGE;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  try {
    const blob = await encodeJpegUnderMaxBytes(bitmap, maxBytes, maxEdge);
    return new File([blob], toJpegFilename(file.name), { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToFile(
  dataUrl: string,
  filename: string,
): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export async function compressDataUrlIfOversized(
  dataUrl: string,
  maxChars = MAX_RESULT_DATA_URL_CHARS,
): Promise<string> {
  if (!dataUrl.startsWith("data:") || dataUrl.length <= maxChars) {
    return dataUrl;
  }

  const file = await dataUrlToFile(dataUrl, "result.png");
  const compressed = await compressImageFile(file);
  return blobToDataUrl(compressed);
}

export async function compressResultDataUrls(
  images: string[],
): Promise<string[]> {
  return Promise.all(images.map((image) => compressDataUrlIfOversized(image)));
}
