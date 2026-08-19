"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const buttonClass =
  "rounded-xl border-2 border-panel-edge bg-panel px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/70";

export function SiteHeader() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b-2 border-panel-edge px-6 py-8 sm:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-foreground no-underline">
          <h1 className="font-display text-5xl tracking-wide text-foreground sm:text-6xl">
            Style Transfer Playground
          </h1>
        </Link>
        <nav className="flex flex-wrap items-center gap-3">
          {isPending ? (
            <span className="text-sm text-muted">Loading...</span>
          ) : session?.user ? (
            <>
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="h-10 w-10 rounded-full border-2 border-panel-edge object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-panel-edge bg-panel font-display text-lg text-accent">
                  {(session.user.name ?? session.user.email ?? "?").slice(0, 1)}
                </span>
              )}
              <span className="max-w-40 truncate text-sm text-muted">
                {session.user.name || session.user.email}
              </span>
              <Link href="/settings" className={buttonClass}>
                Settings
              </Link>
              <button type="button" onClick={() => void handleSignOut()} className={buttonClass}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/sign-in" className={buttonClass}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
