"use client";

import { useId, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getInstagramCookie } from "@/lib/feeds/instagram-cookie";
import type { FeedPlatform } from "@/lib/feeds/types";
import type { StoredExample } from "@/lib/generation/types";
import {
  DEFAULT_FEED_IMPORT,
  MAX_FEED_IMPORT,
  MIN_FEED_IMPORT,
} from "@/lib/images/constants";

const FIELD_CLASS =
  "rounded-xl border-2 border-panel-edge bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

type FeedImportProps = {
  projectId?: string;
  remaining: number;
  disabled?: boolean;
  onImported: (examples: StoredExample[]) => void;
  onError: (message: string | null) => void;
};

function parseCount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const count = Number.parseInt(trimmed, 10);
  return Number.isInteger(count) ? count : null;
}

export function FeedImport({
  projectId,
  remaining,
  disabled = false,
  onImported,
  onError,
}: FeedImportProps) {
  const platformId = useId();
  const sourceId = useId();
  const countId = useId();
  const [platform, setPlatform] = useState<FeedPlatform>("instagram");
  const [source, setSource] = useState("");
  const [count, setCount] = useState(String(DEFAULT_FEED_IMPORT));
  const [isPulling, setIsPulling] = useState(false);
  const { data: session } = authClient.useSession();

  const parsedCount = parseCount(count);
  const maxCount = Math.min(MAX_FEED_IMPORT, Math.max(remaining, 0));
  const countOverMax =
    parsedCount !== null && parsedCount > maxCount && maxCount > 0;
  const pullDisabled =
    disabled ||
    isPulling ||
    remaining <= 0 ||
    !source.trim() ||
    parsedCount === null ||
    parsedCount < MIN_FEED_IMPORT ||
    countOverMax;

  async function pull() {
    if (!projectId) {
      onError("Sign in to pull images from a feed.");
      return;
    }
    if (pullDisabled) {
      return;
    }

    setIsPulling(true);
    onError(null);
    try {
      const instagramCookie =
        platform === "instagram" && session?.user.id
          ? getInstagramCookie(session.user.id)
          : "";
      const response = await fetch(`/api/projects/${projectId}/example-feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          platform,
          count: parsedCount,
          instagramCookie: instagramCookie || undefined,
        }),
      });
      const data = (await response.json()) as {
        examples?: StoredExample[];
        error?: string;
      };
      if (!response.ok || !data.examples) {
        throw new Error(data.error || "Could not pull images from that feed.");
      }
      onImported(data.examples);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Could not pull images from that feed.",
      );
    } finally {
      setIsPulling(false);
    }
  }

  return (
    <div
      className="mt-4"
      onKeyDown={(event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void pull();
      }}
    >
      <span className="text-sm font-medium text-foreground">
        From Instagram or X
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        <label htmlFor={platformId} className="sr-only">
          Source
        </label>
        <select
          id={platformId}
          name="feedPlatform"
          value={platform}
          disabled={isPulling || disabled}
          onChange={(event) => setPlatform(event.target.value as FeedPlatform)}
          className={`${FIELD_CLASS} w-[8.5rem] shrink-0`}
        >
          <option value="instagram">Instagram</option>
          <option value="x">X</option>
        </select>
        <label htmlFor={sourceId} className="sr-only">
          Profile
        </label>
        <input
          id={sourceId}
          name="feedSource"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={source}
          disabled={isPulling || disabled}
          onChange={(event) => setSource(event.target.value)}
          placeholder="@account or profile URL"
          className={`${FIELD_CLASS} min-w-[min(100%,12rem)] flex-1`}
        />
        <label htmlFor={countId} className="sr-only">
          Image count
        </label>
        <input
          id={countId}
          name="feedCount"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={count}
          disabled={isPulling || disabled}
          onChange={(event) => setCount(event.target.value)}
          className={`${FIELD_CLASS} w-24 shrink-0`}
        />
        <button
          type="button"
          disabled={pullDisabled}
          onClick={() => void pull()}
          className="shrink-0 rounded-xl bg-accent px-5 py-3 font-display text-lg tracking-wide text-accent-ink transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPulling ? "Pulling..." : "Pull"}
        </button>
      </div>
      {countOverMax ? (
        <p className="mt-2 text-sm text-amber-300" role="status">
          You can pull up to {maxCount} image{maxCount === 1 ? "" : "s"}.
        </p>
      ) : null}
    </div>
  );
}
