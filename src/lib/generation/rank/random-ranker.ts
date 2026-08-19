import type { GeneratedImage } from "../types";
import type { ImageRanker } from "./ranker";

export class RandomImageRanker implements ImageRanker {
  async rank(images: GeneratedImage[], keep: number): Promise<GeneratedImage[]> {
    const shuffled = [...images];

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const current = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = current;
    }

    return shuffled.slice(0, keep);
  }
}