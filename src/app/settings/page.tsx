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
      <section className="rounded-xl border border-panel-edge bg-panel p-5">
        <h2 className="font-display text-2xl tracking-wide text-accent">
          API keys
        </h2>
        <p className="mt-3 text-sm text-muted">
          Each account stores its own keys, encrypted. Save a key for the
          provider you generate with.{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline-offset-2 hover:underline"
          >
            Google AI Studio
          </a>
          {" · "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline-offset-2 hover:underline"
          >
            OpenAI
          </a>
        </p>
        <div className="mt-6">
          <SettingsForm saved={saved} />
        </div>
      </section>
    </main>
  );
}
