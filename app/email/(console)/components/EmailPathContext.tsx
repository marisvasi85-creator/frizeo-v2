"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { emailHref } from "./emailNav";

const BareEmailPathsContext = createContext(false);

export function EmailPathProvider({
  barePaths,
  children,
}: {
  barePaths: boolean;
  children: ReactNode;
}) {
  return (
    <BareEmailPathsContext.Provider value={barePaths}>
      {children}
    </BareEmailPathsContext.Provider>
  );
}

export function useBareEmailPaths() {
  return useContext(BareEmailPathsContext);
}

/** Console page href helper that respects email.frizeo.ro bare paths. */
export function useEmailHref() {
  const bare = useBareEmailPaths();
  return useCallback((path: string) => emailHref(path, { bare }), [bare]);
}
