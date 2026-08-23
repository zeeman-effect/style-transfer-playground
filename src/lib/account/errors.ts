import {
  MAX_PROJECT_EXAMPLES,
  MAX_PROJECT_GENERATIONS,
} from "@/lib/images/constants";

export class ProjectNotFoundError extends Error {
  readonly status = 404 as const;

  constructor(message = "Project not found.") {
    super(message);
    this.name = "ProjectNotFoundError";
  }
}

export class ExampleLimitError extends Error {
  readonly status = 400 as const;

  constructor(
    message = `You can add up to ${MAX_PROJECT_EXAMPLES} example images.`,
  ) {
    super(message);
    this.name = "ExampleLimitError";
  }
}

export class ExampleNotFoundError extends Error {
  readonly status = 404 as const;

  constructor(message = "Example not found.") {
    super(message);
    this.name = "ExampleNotFoundError";
  }
}

export class ExampleUploadError extends Error {
  readonly status = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = "ExampleUploadError";
  }
}

export class GenerationLimitError extends Error {
  readonly status = 400 as const;

  constructor(
    message = `You can keep up to ${MAX_PROJECT_GENERATIONS} generation batches. Delete a batch to generate more.`,
  ) {
    super(message);
    this.name = "GenerationLimitError";
  }
}

export class GenerationNotFoundError extends Error {
  readonly status = 404 as const;

  constructor(message = "Generation not found.") {
    super(message);
    this.name = "GenerationNotFoundError";
  }
}
