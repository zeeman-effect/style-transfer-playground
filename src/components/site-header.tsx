"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const buttonClass =
  "rounded-xl border border-panel-edge bg-panel px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/70";

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/unlock" || pathname === "/") {
    return null;
  }

  return (
    <div className="flex justify-end px-6 pt-6 sm:px-10">
      <AccountControls />
    </div>
  );
}

export function AccountControls() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    setSessionReady(true);
  }, []);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="flex flex-wrap items-center justify-end gap-3">
      {!sessionReady || isPending ? (
        <span className="text-sm text-muted">Loading...</span>
      ) : session?.user ? (
        <>
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-10 w-10 rounded-xl border border-panel-edge object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-panel-edge bg-panel font-display text-lg text-accent">
              {(session.user.name ?? session.user.email ?? "?").slice(0, 1)}
            </span>
          )}
          <span className="max-w-40 truncate text-sm text-muted">
            {session.user.name || session.user.email}
          </span>
          <Link
            href={pathname === "/settings" ? "/" : "/settings"}
            className={buttonClass}
          >
            {pathname === "/settings" ? "Home" : "Settings"}
          </Link>
          <button type="button" onClick={() => void handleSignOut()} className={buttonClass}>
            Sign out
          </button>
        </>
      ) : pathname === "/sign-in" ? (
        <Link href="/" className={buttonClass}>
          Home
        </Link>
      ) : (
        <Link href="/sign-in" className={buttonClass}>
          Sign in
        </Link>
      )}
    </nav>
  );
}
