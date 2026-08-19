import type { GeneratedImage } from "../types";

export interface ImageRanker {
  rank(images: GeneratedImage[], keep: number): Promise<GeneratedImage[]>;
}
