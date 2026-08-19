import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export class AuthRequiredError extends Error {
  readonly status = 401 as const;

  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthRequiredError();
  }
  return session.user;
}
