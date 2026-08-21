import { Suspense } from "react";
import { Playground } from "@/components/playground";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  const signedIn = Boolean(session?.user);

  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div
            className={
              signedIn
                ? "mx-auto flex w-full max-w-[88rem] flex-1 gap-6 px-6 py-8 sm:px-10"
                : "mx-auto w-full max-w-7xl flex-1 px-6 py-8 sm:px-10"
            }
          />
        }
      >
        <Playground initialSignedIn={signedIn} />
      </Suspense>
    </main>
  );
}
