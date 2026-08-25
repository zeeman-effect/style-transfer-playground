import { describe, expect, it } from "vitest";
import {
  ExampleLimitError,
  ExampleNotFoundError,
  ExampleUploadError,
  GenerationLimitError,
  GenerationNotFoundError,
  ProjectNotFoundError,
} from "@/lib/account/errors";
import {
  MAX_PROJECT_EXAMPLES,
  MAX_PROJECT_GENERATIONS,
} from "@/lib/images/constants";

describe("account error classes", () => {
  it("uses the expected statuses and default messages", () => {
    expect(new ProjectNotFoundError()).toMatchObject({
      name: "ProjectNotFoundError",
      status: 404,
      message: "Project not found.",
    });
    expect(new ExampleLimitError().message).toContain(String(MAX_PROJECT_EXAMPLES));
    expect(new ExampleLimitError().status).toBe(400);
    expect(new ExampleNotFoundError().status).toBe(404);
    expect(new ExampleUploadError("too big")).toMatchObject({
      name: "ExampleUploadError",
      status: 400,
      message: "too big",
    });
    expect(new GenerationLimitError().message).toContain(
      String(MAX_PROJECT_GENERATIONS),
    );
    expect(new GenerationLimitError().status).toBe(400);
    expect(new GenerationNotFoundError().status).toBe(404);
  });
});
