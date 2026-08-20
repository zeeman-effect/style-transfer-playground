/** Soft cap for stored examples: timeout/cost, not a Vercel body limit. */
export const MAX_PROJECT_EXAMPLES = 24;

/** Gemini image-generation input cap (source counts toward the total). */
export const MAX_GOOGLE_INPUT_IMAGES = 14;

/** OpenAI Images edits input cap (source counts toward the total). */
export const MAX_OPENAI_INPUT_IMAGES = 16;

export function capProviderInputImages(
  max: number,
  source?: File,
  references?: File[],
): File[] {
  const refs = references ?? [];
  if (!source) {
    return refs.slice(0, max);
  }
  return [source, ...refs.slice(0, Math.max(0, max - 1))];
}

export const COMPRESS_MAX_EDGE = 1280;
export const COMPRESS_MAX_BYTES = 400 * 1024;
export const COMPRESS_START_QUALITY = 0.85;
export const COMPRESS_MIN_QUALITY = 0.5;
export const COMPRESS_QUALITY_STEP = 0.05;
export const COMPRESS_MIN_EDGE = 320;

export const VISION_ANALYSIS_BATCH = 6;

/** Keep project PATCH JSON under Vercel's 4.5MB body cap. */
export const MAX_RESULT_DATA_URL_CHARS = 3_200_000;

/** Server-side guard if a client skips compression. */
export const MAX_EXAMPLE_UPLOAD_BYTES = 1_500_000;

export const MIN_FEED_IMPORT = 1;
export const DEFAULT_FEED_IMPORT = 8;
export const MAX_FEED_IMPORT = 12;
