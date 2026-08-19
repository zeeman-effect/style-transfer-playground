"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MemeGenerator, type MemeGeneratorHandle } from "@/components/meme-generator";
import { ProjectSidebar } from "@/components/project-sidebar";
import { authClient } from "@/lib/auth-client";
import type { ProjectRecord, ProjectSummary } from "@/lib/generation/types";

const UNSIGNED_LAYOUT =
  "mx-auto w-full max-w-7xl flex-1 px-6 py-8 sm:px-10";
const SIGNED_LAYOUT =
  "mx-auto flex w-full max-w-[88rem] flex-1 gap-6 px-6 py-8 sm:px-10";

function setProjectQuery(router: ReturnType<typeof useRouter>, id: string) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("project") === id) {
    return;
  }
  params.set("project", id);
  router.replace(`/?${params.toString()}`, { scroll: false });
}

export function Playground() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("project");
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  const generatorRef = useRef<MemeGeneratorHandle>(null);
  const activeIdRef = useRef<string | null>(null);
  const bootstrappedRef = useRef(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProjectRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async (id: string) => {
    const response = await fetch(`/api/projects/${id}`);
    const data = (await response.json()) as {
      project?: ProjectRecord;
      error?: string;
    };
    if (!response.ok || !data.project) {
      throw new Error(data.error || "Could not load project.");
    }
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opened: true }),
    });
    return data.project;
  }, []);

  const applyActiveProject = useCallback(
    (id: string, project: ProjectRecord) => {
      activeIdRef.current = id;
      setActiveId(id);
      setSnapshot(project);
      setProjectQuery(router, id);
    },
    [router],
  );

  useEffect(() => {
    if (!signedIn) {
      bootstrappedRef.current = false;
    }
  }, [signedIn]);

  useEffect(() => {
    if (sessionPending || !signedIn) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setError(null);
      try {
        const response = await fetch("/api/projects");
        const data = (await response.json()) as {
          projects?: ProjectSummary[];
          lastOpenedId?: string;
          error?: string;
        };
        if (!response.ok || !data.projects?.length || !data.lastOpenedId) {
          throw new Error(data.error || "Could not load projects.");
        }
        if (cancelled) {
          return;
        }

        setProjects(data.projects);
        const selectedId =
          requestedId && data.projects.some((entry) => entry.id === requestedId)
            ? requestedId
            : data.lastOpenedId;
        const project = await loadProject(selectedId);
        if (cancelled) {
          return;
        }
        bootstrappedRef.current = true;
        applyActiveProject(selectedId, project);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load projects.",
          );
        }
      }
    }

    async function applyQueryProject() {
      if (!requestedId || requestedId === activeIdRef.current) {
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await generatorRef.current?.flushSave();
        const project = await loadProject(requestedId);
        if (cancelled) {
          return;
        }
        applyActiveProject(requestedId, project);
      } catch (selectError) {
        if (!cancelled) {
          setError(
            selectError instanceof Error
              ? selectError.message
              : "Could not switch project.",
          );
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    }

    if (!bootstrappedRef.current) {
      void bootstrap();
    } else {
      void applyQueryProject();
    }

    return () => {
      cancelled = true;
    };
  }, [applyActiveProject, loadProject, requestedId, sessionPending, signedIn]);

  async function flushCurrent() {
    await generatorRef.current?.flushSave();
  }

  async function selectProject(id: string) {
    if (id === activeIdRef.current || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await flushCurrent();
      const project = await loadProject(id);
      applyActiveProject(id, project);
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "Could not switch project.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await flushCurrent();
      const response = await fetch("/api/projects", { method: "POST" });
      const data = (await response.json()) as {
        project?: ProjectRecord;
        error?: string;
      };
      if (!response.ok || !data.project) {
        throw new Error(data.error || "Could not create project.");
      }
      setProjects((current) => [data.project!, ...current]);
      applyActiveProject(data.project.id, data.project);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create project.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function renameProject(id: string, name: string) {
    setProjects((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, name } : entry)),
    );
    if (snapshot?.id === id) {
      setSnapshot({ ...snapshot, name });
    }

    const response = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await response.json()) as {
      project?: ProjectSummary;
      error?: string;
    };
    if (!response.ok) {
      setError(data.error || "Could not rename project.");
      return;
    }
    if (data.project) {
      setProjects((current) =>
        current.map((entry) => (entry.id === id ? data.project! : entry)),
      );
    }
  }

  async function deleteProject(id: string) {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (id === activeIdRef.current) {
        await flushCurrent();
      }
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const data = (await response.json()) as {
        projects?: ProjectSummary[];
        lastOpenedId?: string;
        replacement?: ProjectRecord | null;
        error?: string;
      };
      if (!response.ok || !data.projects?.length || !data.lastOpenedId) {
        throw new Error(data.error || "Could not delete project.");
      }

      setProjects(data.projects);
      if (id !== activeIdRef.current) {
        return;
      }

      const nextId = data.lastOpenedId;
      const nextSnapshot =
        data.replacement && data.replacement.id === nextId
          ? data.replacement
          : await loadProject(nextId);
      applyActiveProject(nextId, nextSnapshot);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete project.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleSaved() {
    const id = activeIdRef.current;
    if (!id) {
      return;
    }
    const updatedAt = Date.now();
    setProjects((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, updatedAt } : entry,
      ),
    );
  }

  if (sessionPending || !signedIn) {
    return (
      <div className={UNSIGNED_LAYOUT}>
        <MemeGenerator />
      </div>
    );
  }

  return (
    <div className={SIGNED_LAYOUT}>
      <ProjectSidebar
        projects={projects}
        selectedId={activeId}
        disabled={busy}
        onSelect={(id) => {
          void selectProject(id);
        }}
        onCreate={() => {
          void createProject();
        }}
        onRename={(id, name) => {
          void renameProject(id, name);
        }}
        onDelete={(id) => {
          void deleteProject(id);
        }}
      />
      <div className="min-w-0 flex-1">
        {error ? (
          <p className="mb-4 text-sm text-red-300" role="status">
            {error}
          </p>
        ) : null}
        {snapshot && activeId ? (
          <MemeGenerator
            key={activeId}
            ref={generatorRef}
            projectId={activeId}
            initialSnapshot={snapshot}
            onSaved={handleSaved}
          />
        ) : null}
      </div>
    </div>
  );
}
