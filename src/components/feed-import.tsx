"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FeedError } from "@/lib/feeds/errors";
import {
  IG_IMPORT_RELAY_PATH,
  IG_RELAY_WINDOW_NAME,
  IG_WINDOW_NAME,
  instagramImportBookmarklet,
  instagramImportScript,
  parseInstagramImportStatus,
} from "@/lib/feeds/instagram-import-client";
import { parseFeedSource } from "@/lib/feeds/parse";
import type { FeedPlatform } from "@/lib/feeds/types";
import type { StoredExample } from "@/lib/generation/types";
import {
  DEFAULT_FEED_IMPORT,
  MAX_FEED_IMPORT,
  MIN_FEED_IMPORT,
} from "@/lib/images/constants";

const FIELD_CLASS =
  "rounded-xl border border-panel-edge bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

type FeedImportProps = {
  projectId?: string;
  remaining: number;
  disabled?: boolean;
  onImported: (examples: StoredExample[]) => void;
  onError: (message: string | null) => void;
};

type Assist = {
  username: string;
  bookmarklet: string;
  script: string;
  profileUrl: string;
  token: string;
};

/** How long the app keeps watching for an import started from Instagram. */
const WATCH_TIMEOUT_MS = 15 * 60 * 1000;
const WATCH_INTERVAL_MS = 2500;

function parseCount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const count = Number.parseInt(trimmed, 10);
  return Number.isInteger(count) ? count : null;
}

function instagramProfileUrl(username: string) {
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
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
  const [assist, setAssist] = useState<Assist | null>(null);
  const [copied, setCopied] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const pullingRef = useRef(false);

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

  // The relay tab posts the images to this origin; this tab watches for the
  // result and folds the new examples in.
  const importedRef = useRef(onImported);
  useEffect(() => {
    importedRef.current = onImported;
  }, [onImported]);

  const watchToken = assist?.token ?? null;
  useEffect(() => {
    if (!watchToken) {
      return;
    }
    let stopped = false;
    const startedAt = Date.now();

    async function check() {
      if (stopped) {
        return;
      }
      try {
        const response = await fetch(
          `/api/feed-import?token=${encodeURIComponent(watchToken as string)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          return;
        }
        const status = parseInstagramImportStatus(await response.json());
        if (stopped) {
          return;
        }
        if (status.status === "done" && status.examples.length > 0) {
          stopped = true;
          setCopied(false);
          setAssist(null);
          setPullError(null);
          onError(null);
          importedRef.current(status.examples);
          return;
        }
        if (status.status === "error") {
          stopped = true;
          setPullError(status.error ?? "Could not import those images.");
        }
      } catch {
        // Offline or the dev server restarted; the next tick tries again.
      }
    }

    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > WATCH_TIMEOUT_MS) {
        window.clearInterval(timer);
        return;
      }
      void check();
    }, WATCH_INTERVAL_MS);

    // Coming back to this tab is the moment the result usually matters.
    function onVisible() {
      if (document.visibilityState === "visible") {
        void check();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    void check();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onError, watchToken]);

  async function buildAssist(username: string, take: number): Promise<string> {
    const response = await fetch("/api/feed-import/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, source, count: take }),
    });
    const data = (await response.json()) as { token?: string; error?: string };
    if (!response.ok || !data.token) {
      throw new FeedError(data.error || "Could not start the import.");
    }
    const config = {
      relayUrl: `${window.location.origin}${IG_IMPORT_RELAY_PATH}`,
      relayWindowName: IG_RELAY_WINDOW_NAME,
      token: data.token,
      username,
      count: take,
    };
    const script = instagramImportScript(config);
    setAssist({
      username,
      bookmarklet: instagramImportBookmarklet(config),
      script,
      profileUrl: instagramProfileUrl(username),
      token: data.token,
    });
    return script;
  }

  function copyScript(script: string) {
    let write: Promise<void> | null = null;
    try {
      write = navigator.clipboard?.writeText(script) ?? null;
    } catch {
      write = null;
    }
    if (!write) {
      setCopied(false);
      return;
    }
    void write.then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  /**
   * The script only exists once the server has issued a token, but the
   * clipboard needs claiming while the click is still the active gesture.
   * A ClipboardItem accepts the pending text, so the write is authorized now
   * and filled in when the token arrives.
   */
  function copyPendingScript(script: Promise<string>) {
    setCopied(false);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          "text/plain": script.then(
            (text) => new Blob([text], { type: "text/plain" }),
          ),
        });
        void navigator.clipboard.write([item]).then(
          () => setCopied(true),
          () => setCopied(false),
        );
        return;
      }
    } catch {
      // Fall through to the plain write below.
    }
    void script.then(copyScript, () => setCopied(false));
  }

  async function pull() {
    if (!projectId) {
      onError("Sign in to pull images from a feed.");
      return;
    }
    if (pullDisabled) {
      return;
    }
    if (pullingRef.current) {
      return;
    }

    if (platform === "instagram") {
      if (parsedCount === null) {
        return;
      }
      let username: string;
      try {
        username = parseFeedSource(source, "instagram").username;
      } catch (error) {
        onError(
          error instanceof FeedError
            ? error.message
            : "Enter an Instagram or X profile URL or @handle.",
        );
        return;
      }
      onError(null);
      setPullError(null);
      // Both of these have to happen while the click is still the active user
      // gesture, so neither can wait on the token request.
      const script = buildAssist(username, parsedCount);
      copyPendingScript(script);
      window.open(instagramProfileUrl(username), IG_WINDOW_NAME);
      script.catch((error) => {
        setAssist(null);
        onError(
          error instanceof FeedError
            ? error.message
            : "Could not start the import.",
        );
      });
      return;
    }

    pullingRef.current = true;
    setIsPulling(true);
    onError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/example-feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          platform,
          count: parsedCount,
        }),
      });
      const data = (await response.json()) as {
        examples?: StoredExample[];
        error?: string;
      };
      if (!response.ok || !data.examples) {
        throw new Error(data.error || "Could not pull images from that feed.");
      }
      setAssist(null);
      onImported(data.examples);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Could not pull images from that feed.",
      );
    } finally {
      pullingRef.current = false;
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
      <p className="mt-1 text-sm text-muted">
        X downloads photos from the public timeline. Instagram opens the
        profile so you can paste a script in that tab&apos;s console (F12).
      </p>
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
      {pullError ? (
        <p className="mt-2 text-sm text-red-300" role="status">
          {pullError}
        </p>
      ) : null}
      {assist ? (
        <div className="mt-3 flex flex-col gap-2 text-sm text-foreground">
          <span>
            {copied
              ? `The import script is on your clipboard. Switch to the @${assist.username} tab, open the console (F12) and paste it. The images land here when it finishes.`
              : `On the @${assist.username} tab, open the console (F12), then use Copy script and paste it there. The images land here when it finishes.`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={assist.profileUrl}
              target={IG_WINDOW_NAME}
              rel="opener"
              className="rounded-xl border border-panel-edge px-4 py-2 text-sm font-medium"
            >
              Open profile
            </a>
            <button
              type="button"
              onClick={() => copyScript(assist.script)}
              className="rounded-xl bg-accent px-4 py-2 font-display text-base tracking-wide text-accent-ink"
            >
              {copied ? "Copied" : "Copy script"}
            </button>
            <a
              href={assist.bookmarklet}
              title="Drag to the bookmarks bar"
              onClick={(event) => event.preventDefault()}
              className="rounded-xl border border-panel-edge px-4 py-2 text-sm font-medium"
            >
              Bookmarklet
            </a>
            <button
              type="button"
              onClick={() => {
                const token = assist.token;
                setCopied(false);
                setAssist(null);
                setPullError(null);
                void fetch(
                  `/api/feed-import?token=${encodeURIComponent(token)}`,
                  { method: "DELETE" },
                ).catch(() => {});
              }}
              className="rounded-xl border border-panel-edge px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
