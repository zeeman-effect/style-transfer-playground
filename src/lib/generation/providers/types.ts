import type { GeneratedImage } from "../types";

export type TextToImageInput = {
  prompt: string;
  count: number;
  modelId: string;
  images?: File[];
};

export type ImageAndTextToImageInput = TextToImageInput & {
  image: File;
};

export type TextToTextInput = {
  prompt: string;
  modelId: string;
};

export type ImageToTextInput = TextToTextInput & {
  image: File;
};

export interface ModelProvider {
  textToImage(input: TextToImageInput): Promise<GeneratedImage[]>;
  imageAndTextToImage(input: ImageAndTextToImageInput): Promise<GeneratedImage[]>;
  imageToText(input: ImageToTextInput): Promise<string>;
  textToText(input: TextToTextInput): Promise<string>;
}

export type WrapModelProvider = (provider: ModelProvider) => ModelProvider;
