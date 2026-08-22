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

function extensionFromImageSrc(src: string): string {
  const mime = src.match(/^data:([^;,]+)/)?.[1] ?? "";
  if (mime === "image/png") {
    return "png";
  }
  return "jpg";
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
  );
}

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
  const filename = `meme-${index + 1}.${extensionFromImageSrc(image)}`;

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
    <div>
      <div className="mb-3 flex items-start justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-xl border border-panel-edge bg-background/80 px-2 py-1 text-xs uppercase tracking-wide text-accent"
        >
          X
        </button>
      </div>

      <div className="group relative overflow-hidden rounded-lg border border-panel-edge bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={`Generated meme ${index + 1}`}
          className="mx-auto max-h-[min(48vh,26rem)] w-full object-contain"
        />
        <a
          href={image}
          download={filename}
          aria-label="Download"
          className="absolute right-2 top-2 rounded-xl bg-background/80 p-2 text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <DownloadIcon />
        </a>
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
    </div>
  );
}
