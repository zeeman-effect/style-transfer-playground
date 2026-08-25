import { vi } from "vitest";

export class AuthRequiredError extends Error {
  readonly status = 401 as const;

  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export const requireUser = vi.fn();
export const getSession = vi.fn();
