import type { StyleAnalysis, StyleAnalyzer } from "./analyzer";

export class NoopStyleAnalyzer implements StyleAnalyzer {
  async analyze(examples: File[]): Promise<StyleAnalysis> {
    void examples;
    return { styleHint: "" };
  }
}
