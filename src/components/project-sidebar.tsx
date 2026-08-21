"use client";

import { useState } from "react";
import type { ProjectSummary } from "@/lib/generation/types";

type ProjectSidebarProps = {
  projects: ProjectSummary[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

export function ProjectSidebar({
  projects,
  selectedId,
  disabled = false,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  function commitRename(id: string, currentName: string) {
    const nextName = (editingId === id ? draftName : currentName).trim();
    setEditingId(null);
    if (nextName.length === 0 || nextName === currentName) {
      return;
    }
    onRename(id, nextName);
  }

  return (
    <aside className="w-64 shrink-0">
      <div className="sticky top-6 rounded-xl border border-panel-edge bg-panel p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl tracking-wide text-accent">
            Projects
          </h2>
          <button
            type="button"
            disabled={disabled}
            onClick={onCreate}
            className="rounded-xl border border-panel-edge bg-background px-3 py-1 text-sm font-medium text-foreground transition-colors hover:border-accent/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            New
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {projects.map((entry) => {
            const selected = entry.id === selectedId;
            return (
              <li key={entry.id}>
                <div
                  className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-panel-edge bg-background"
                  }`}
                >
                  {selected ? (
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
                      onClick={() => onSelect(entry.id)}
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
    </aside>
  );
}
