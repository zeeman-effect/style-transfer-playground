import { redirect } from "next/navigation";
import { submitSitePassword } from "@/app/unlock/actions";
import { getSitePassword, sanitizeReturnPath } from "@/lib/site-access";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  if (!getSitePassword()) {
    redirect("/");
  }

  const params = await searchParams;
  const from = sanitizeReturnPath(params.from);
  const error = params.error === "1";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-start px-6 py-8 sm:px-10">
      <section className="w-full rounded-2xl border-2 border-panel-edge bg-panel p-5 shadow-[8px_8px_0_#0a0806]">
        <h2 className="font-display text-2xl tracking-wide text-accent">
          Password
        </h2>
        <form action={submitSitePassword} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="from" value={from} />
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-xl border-2 border-panel-edge bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-xl border-2 border-panel-edge bg-background px-5 py-3 font-display text-xl tracking-wide text-foreground transition-transform hover:-translate-y-0.5"
          >
            Continue
          </button>
          {error ? (
            <p className="text-sm text-red-300">That password is incorrect.</p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
