import { vi } from "vitest";

export const USER = { id: "user-1" };

export function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function formRequest(
  url: string,
  fields: Record<string, string | File>,
): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  const request = new Request(url, { method: "POST", body: form });
  // jsdom's Request.formData() can hang when the body includes a File.
  Object.defineProperty(request, "formData", {
    value: async () => form,
  });
  return request;
}

export function routeParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

export function createFakeLogger() {
  return {
    setConfiguredProviders: vi.fn(),
    setProjectId: vi.fn(),
    setRequest: vi.fn(),
    markSuccess: vi.fn(),
    markError: vi.fn(),
    finish: vi.fn().mockResolvedValue(undefined),
  };
}
