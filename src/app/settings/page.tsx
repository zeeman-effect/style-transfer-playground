import { redirect } from "next/navigation";
import { SettingsForm } from "@/app/settings/settings-form";
import { getStoredProviderFlags } from "@/lib/account/keys";
import { getSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const saved = await getStoredProviderFlags(session.user.id);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8 sm:px-10">
      <section className="rounded-2xl border-2 border-panel-edge bg-panel p-5 shadow-[8px_8px_0_#0a0806]">
        <h2 className="font-display text-2xl tracking-wide text-accent">
          API keys
        </h2>
        <div className="mt-6">
          <SettingsForm saved={saved} />
        </div>
      </section>
    </main>
  );
}
