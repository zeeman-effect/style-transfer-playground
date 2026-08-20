import sharp from "sharp";

export const MAX_COMPOSITE_EXAMPLES = 16;

const COMPOSITE_MAX_EDGE = 1280;
const COMPOSITE_MAX_BYTES = 500 * 1024;
const COMPOSITE_START_QUALITY = 70;
const COMPOSITE_MIN_QUALITY = 50;
const COMPOSITE_QUALITY_STEP = 5;
const COMPOSITE_MIN_EDGE = 320;
const COMPOSITE_EDGE_SCALE = 0.85;

type GridBitmap = {
  buffer: Buffer;
  width: number;
  height: number;
};

export async function buildCompositeImage(
  examples: File[],
): Promise<File | null> {
  const sources: Buffer[] = [];
  for (const file of examples.slice(0, MAX_COMPOSITE_EXAMPLES)) {
    const loaded = await tryLoadImageBuffer(file);
    if (loaded) {
      sources.push(loaded);
    }
  }

  if (sources.length === 0) {
    return null;
  }

  const cols = Math.ceil(Math.sqrt(sources.length));
  const rows = Math.ceil(sources.length / cols);
  const rendered = await renderGrid(sources, cols, rows, COMPOSITE_MAX_EDGE);
  if (!rendered) {
    return null;
  }
  let grid = rendered;

  let quality = COMPOSITE_START_QUALITY;
  let jpeg = await encodeJpeg(grid, quality);
  while (jpeg.byteLength > COMPOSITE_MAX_BYTES && quality > COMPOSITE_MIN_QUALITY) {
    quality = Math.max(COMPOSITE_MIN_QUALITY, quality - COMPOSITE_QUALITY_STEP);
    jpeg = await encodeJpeg(grid, quality);
  }

  while (
    jpeg.byteLength > COMPOSITE_MAX_BYTES &&
    Math.max(grid.width, grid.height) > COMPOSITE_MIN_EDGE
  ) {
    const width = Math.max(1, Math.round(grid.width * COMPOSITE_EDGE_SCALE));
    const height = Math.max(1, Math.round(grid.height * COMPOSITE_EDGE_SCALE));
    grid = await resizeGrid(grid, width, height);
    jpeg = await encodeJpeg(grid, COMPOSITE_MIN_QUALITY);
  }

  return new File([new Uint8Array(jpeg)], "composite.jpg", {
    type: "image/jpeg",
  });
}

async function tryLoadImageBuffer(file: File): Promise<Buffer | null> {
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength === 0) {
      return null;
    }
    const meta = await sharp(bytes).rotate().metadata();
    if (!meta.width || !meta.height) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

async function renderGrid(
  sources: Buffer[],
  cols: number,
  rows: number,
  maxEdge: number,
): Promise<GridBitmap | null> {
  const cellSize = Math.max(1, Math.floor(maxEdge / Math.max(cols, rows)));
  const width = cellSize * cols;
  const height = cellSize * rows;

  const overlays: Array<{
    input: Buffer;
    left: number;
    top: number;
  }> = [];
  for (const [index, source] of sources.entries()) {
    try {
      overlays.push({
        input: await sharp(source)
          .rotate()
          .resize(cellSize, cellSize, { fit: "cover" })
          .toBuffer(),
        left: (index % cols) * cellSize,
        top: Math.floor(index / cols) * cellSize,
      });
    } catch {
      // Skip tiles that fail to decode at resize time; unused cells stay black.
    }
  }

  if (overlays.length === 0) {
    return null;
  }

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(overlays)
    .png()
    .toBuffer();

  return { buffer, width, height };
}

async function resizeGrid(
  grid: GridBitmap,
  width: number,
  height: number,
): Promise<GridBitmap> {
  const buffer = await sharp(grid.buffer).resize(width, height).png().toBuffer();
  return { buffer, width, height };
}

function encodeJpeg(grid: GridBitmap, quality: number): Promise<Buffer> {
  return sharp(grid.buffer).jpeg({ quality }).toBuffer();
}
