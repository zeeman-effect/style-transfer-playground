"use client";

import { useId, useRef } from "react";
import { STYLE_ANALYZERS } from "@/lib/generation/style/catalog";

export function AnalyzerHelp() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label="How analyzers work"
        className="inline-flex h-5 w-5 items-center justify-center rounded-xl border border-panel-edge text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        ?
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(100%-2rem,24rem)] max-h-[min(28rem,calc(100vh-2rem))] overflow-y-auto rounded-xl border border-panel-edge bg-panel p-5 text-foreground backdrop:bg-background/80"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            close();
          }
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3
            id={titleId}
            className="font-display text-xl tracking-wide text-accent"
          >
            Analyzers
          </h3>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-xl border border-panel-edge bg-background/80 px-2 py-1 text-xs uppercase tracking-wide text-accent"
          >
            X
          </button>
        </div>
        <p className="text-sm text-muted">
          How example images influence the generated meme.
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {STYLE_ANALYZERS.map((analyzer) => (
            <li key={analyzer.id}>
              <p className="text-sm font-medium text-foreground">
                {analyzer.label}
              </p>
              <p className="mt-1 text-sm text-muted">{analyzer.summary}</p>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
