"use client";

import { useEffect, useId } from "react";

type ResultInspectorProps = {
  image: string;
  index: number;
  updateText: string;
  onUpdateTextChange: (value: string) => void;
  onModify: () => void;
  onClose: () => void;
  isModifying: boolean;
  modifyDisabled: boolean;
};

function extensionFromDataUrl(dataUrl: string): string {
  const mime = dataUrl.match(/^data:([^;,]+)/)?.[1] ?? "image/jpeg";
  return mime === "image/png" ? "png" : "jpg";
}

function handleShare() {}

export function ResultInspector({
  image,
  index,
  updateText,
  onUpdateTextChange,
  onModify,
  onClose,
  isModifying,
  modifyDisabled,
}: ResultInspectorProps) {
  const updateId = useId();
  const filename = `meme-${index + 1}.${extensionFromDataUrl(image)}`;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section className="rounded-xl border border-panel-edge bg-panel p-5">
      <div className="mb-4 flex items-start justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-xl border border-panel-edge bg-background/80 px-2 py-1 text-xs uppercase tracking-wide text-accent"
        >
          X
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-panel-edge bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={`Generated meme ${index + 1}`}
          className="aspect-square w-full object-contain"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <a
          href={image}
          download={filename}
          className="rounded-xl border border-panel-edge px-5 py-3 text-center font-display text-xl tracking-wide text-accent transition-transform hover:-translate-y-0.5"
        >
          Download
        </a>
        <button
          type="button"
          onClick={handleShare}
          className="rounded-xl border border-panel-edge px-5 py-3 font-display text-xl tracking-wide text-accent transition-transform hover:-translate-y-0.5"
        >
          Share
        </button>
      </div>

      <label htmlFor={updateId} className="mt-4 block">
        <span className="sr-only">Update image</span>
        <textarea
          id={updateId}
          value={updateText}
          onChange={(event) => onUpdateTextChange(event.target.value)}
          rows={3}
          wrap="soft"
          placeholder="Update image..."
          className="mt-0 w-full resize-y rounded-xl border border-panel-edge bg-background px-4 py-3 text-base leading-6 text-foreground outline-none placeholder:text-muted/70 focus:border-accent"
        />
      </label>

      <button
        type="button"
        onClick={onModify}
        disabled={modifyDisabled}
        className="mt-4 w-full rounded-xl bg-accent px-5 py-3 font-display text-xl tracking-wide text-accent-ink shadow-glow transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
      >
        {isModifying ? "Modifying..." : "Modify Image"}
      </button>
    </section>
  );
}
