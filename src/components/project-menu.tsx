"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ProjectChrome } from "@/components/project-chrome";

const triggerClass =
  "max-w-48 truncate rounded-xl border border-panel-edge bg-panel px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/70 disabled:cursor-not-allowed disabled:opacity-60";

export function ProjectMenu({
  projects,
  selectedId,
  disabled = false,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ProjectChrome) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const selected = projects.find((entry) => entry.id === selectedId);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
      setEditingId(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setEditingId(null);
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function commitRename(id: string, currentName: string) {
    const nextName = (editingId === id ? draftName : currentName).trim();
    setEditingId(null);
    if (nextName.length === 0 || nextName === currentName) {
      return;
    }
    onRename(id, nextName);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={triggerClass}
      >
        {selected?.name ?? "Projects"}
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-panel-edge bg-panel p-3 shadow-glow"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Projects</p>
            <button
              type="button"
              disabled={disabled}
              onClick={onCreate}
              className="rounded-xl border border-panel-edge bg-background px-3 py-1 text-sm font-medium text-foreground transition-colors hover:border-accent/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              New
            </button>
          </div>
          <ul className="flex max-h-[min(24rem,70vh)] flex-col gap-2 overflow-y-auto">
            {projects.map((entry) => {
              const isSelected = entry.id === selectedId;
              return (
                <li key={entry.id}>
                  <div
                    className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${
                      isSelected
                        ? "border-accent bg-accent/10"
                        : "border-panel-edge bg-background"
                    }`}
                  >
                    {isSelected ? (
                      <input
                        value={editingId === entry.id ? draftName : entry.name}
                        disabled={disabled}
                        aria-label="Project name"
                        onFocus={() => {
                          setEditingId(entry.id);
                          setDraftName(entry.name);
                        }}
                        onChange={(event) => {
                          setEditingId(entry.id);
                          setDraftName(event.target.value);
                        }}
                        onBlur={() => commitRename(entry.id, entry.name)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            setEditingId(null);
                            event.currentTarget.blur();
                          }
                        }}
                        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          onSelect(entry.id);
                          setOpen(false);
                        }}
                        className="min-w-0 flex-1 truncate text-left text-sm text-foreground disabled:cursor-not-allowed"
                      >
                        {entry.name}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Delete ${entry.name}`}
                      onClick={() => {
                        if (window.confirm(`Delete "${entry.name}"?`)) {
                          onDelete(entry.id);
                        }
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs uppercase tracking-wide text-muted transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
