import type { StyleAnalyzer } from "./analyzer";

export class NoopStyleAnalyzer implements StyleAnalyzer {
  async analyze(examples: File[]): Promise<string> {
    void examples;
    return "";
  }
}
