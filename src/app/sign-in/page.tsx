import { redirect } from "next/navigation";
import { SignInButtons } from "@/app/sign-in/sign-in-buttons";
import { getSession } from "@/lib/auth/session";

export default async function SignInPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-start px-6 py-8 sm:px-10">
      <section className="w-full rounded-2xl border-2 border-panel-edge bg-panel p-5 shadow-[8px_8px_0_#0a0806]">
        <h2 className="font-display text-2xl tracking-wide text-accent">
          Sign in
        </h2>
        <div className="mt-6">
          <SignInButtons />
        </div>
      </section>
    </main>
  );
}
