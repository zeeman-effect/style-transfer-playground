"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButtons() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setPending(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (signInError) {
      setPending(false);
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Could not start sign-in.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => void signIn()}
        className="w-full rounded-xl border-2 border-panel-edge bg-background px-5 py-3 font-display text-xl tracking-wide text-foreground transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Redirecting..." : "Continue with Google"}
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
