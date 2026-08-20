"use client";

import { useEffect, useState } from "react";
import {
  hasInstagramCookie,
  removeInstagramCookie,
  saveInstagramCookie,
} from "@/lib/feeds/instagram-cookie";
import type { ProviderId } from "@/lib/generation/types";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "google", label: "Google Gemini" },
  { id: "openai", label: "OpenAI" },
];

const FIELD_CLASS =
  "mt-2 w-full rounded-xl border-2 border-panel-edge bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent";

type Pending = ProviderId | "instagram" | null;

type SettingsFormProps = {
  userId: string;
  saved: Record<ProviderId, boolean>;
};

export function SettingsForm({ userId, saved }: SettingsFormProps) {
  const [savedFlags, setSavedFlags] = useState(saved);
  const [instagramSaved, setInstagramSaved] = useState(false);
  const [values, setValues] = useState<Record<ProviderId, string>>({
    google: "",
    openai: "",
  });
  const [instagramCookie, setInstagramCookie] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInstagramSaved(hasInstagramCookie(userId));
  }, [userId]);

  async function saveKey(provider: ProviderId) {
    const key = values[provider].trim();
    if (!key) {
      setError("API key is required.");
      return;
    }

    setError(null);
    setPending(provider);
    try {
      const response = await fetch("/api/account/keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save API key.");
      }
      setSavedFlags((current) => ({ ...current, [provider]: true }));
      setValues((current) => ({ ...current, [provider]: "" }));
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save API key.",
      );
    } finally {
      setPending(null);
    }
  }

  async function removeKey(provider: ProviderId) {
    setError(null);
    setPending(provider);
    try {
      const response = await fetch("/api/account/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not remove API key.");
      }
      setSavedFlags((current) => ({ ...current, [provider]: false }));
      setValues((current) => ({ ...current, [provider]: "" }));
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove API key.",
      );
    } finally {
      setPending(null);
    }
  }

  function saveCookie() {
    setError(null);
    setPending("instagram");
    try {
      saveInstagramCookie(userId, instagramCookie);
      setInstagramSaved(true);
      setInstagramCookie("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save Instagram cookie.",
      );
    } finally {
      setPending(null);
    }
  }

  function removeCookie() {
    setError(null);
    setPending("instagram");
    try {
      removeInstagramCookie(userId);
      setInstagramSaved(false);
      setInstagramCookie("");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove Instagram cookie.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {PROVIDERS.map((provider) => (
        <div key={provider.id}>
          <label htmlFor={`key-${provider.id}`} className="block">
            <span className="text-sm font-medium text-foreground">
              {provider.label}
            </span>
            <span className="ml-2 text-xs uppercase tracking-widest text-muted">
              {savedFlags[provider.id] ? "saved" : "empty"}
            </span>
            <input
              id={`key-${provider.id}`}
              type="password"
              autoComplete="off"
              value={values[provider.id]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [provider.id]: event.target.value,
                }))
              }
              placeholder={
                savedFlags[provider.id] ? "Saved" : "Paste API key"
              }
              className={FIELD_CLASS}
            />
          </label>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void saveKey(provider.id)}
              className="rounded-xl bg-accent px-5 py-2 font-display text-lg tracking-wide text-accent-ink transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === provider.id ? "Saving..." : "Save"}
            </button>
            {savedFlags[provider.id] ? (
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void removeKey(provider.id)}
                className="rounded-xl border-2 border-panel-edge px-5 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <div>
        <label htmlFor="instagram-cookie" className="block">
          <span className="text-sm font-medium text-foreground">
            Instagram cookie
          </span>
          <span className="ml-2 text-xs uppercase tracking-widest text-muted">
            {instagramSaved ? "saved" : "empty"}
          </span>
          <input
            id="instagram-cookie"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={instagramCookie}
            onChange={(event) => setInstagramCookie(event.target.value)}
            placeholder={instagramSaved ? "Saved" : "Paste Cookie header"}
            className={FIELD_CLASS}
          />
        </label>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={pending !== null}
            onClick={saveCookie}
            className="rounded-xl bg-accent px-5 py-2 font-display text-lg tracking-wide text-accent-ink transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "instagram" ? "Saving..." : "Save"}
          </button>
          {instagramSaved ? (
            <button
              type="button"
              disabled={pending !== null}
              onClick={removeCookie}
              className="rounded-xl border-2 border-panel-edge px-5 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
