import { Suspense } from "react";
import { Playground } from "@/components/playground";

export default function Home() {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 sm:px-10" />
        }
      >
        <Playground />
      </Suspense>
    </main>
  );
}
