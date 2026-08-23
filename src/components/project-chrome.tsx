"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ProjectSummary } from "@/lib/generation/types";

export type ProjectChrome = {
  projects: ProjectSummary[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

const ProjectChromeContext = createContext<ProjectChrome | null>(null);
const SetProjectChromeContext = createContext<
  (value: ProjectChrome | null) => void
>(() => {});

export function ProjectChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<ProjectChrome | null>(null);

  return (
    <SetProjectChromeContext.Provider value={setChrome}>
      <ProjectChromeContext.Provider value={chrome}>
        {children}
      </ProjectChromeContext.Provider>
    </SetProjectChromeContext.Provider>
  );
}

export function useProjectChrome() {
  return useContext(ProjectChromeContext);
}

export function useRegisterProjectChrome(value: ProjectChrome | null) {
  const setChrome = useContext(SetProjectChromeContext);

  useEffect(() => {
    setChrome(value);
  }, [setChrome, value]);

  useEffect(() => {
    return () => setChrome(null);
  }, [setChrome]);
}
