import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Heading } from '@/lib/markdownOutline';

interface DocumentOutlineValue {
  headings: Heading[];
  setHeadings: (headings: Heading[]) => void;
}

/**
 * Data-only channel from the page being read to the shell's "En este
 * documento" slot. The default is a no-op so pages render without a provider.
 */
const DocumentOutlineContext = createContext<DocumentOutlineValue>({
  headings: [],
  setHeadings: () => {},
});

export function DocumentOutlineProvider({ children }: { children: ReactNode }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  return <DocumentOutlineContext.Provider value={{ headings, setHeadings }}>{children}</DocumentOutlineContext.Provider>;
}

/** Publishes the page's outline while it is mounted and clears it on unmount. */
export function useDocumentOutline(headings: Heading[]): void {
  const { setHeadings } = useContext(DocumentOutlineContext);
  useEffect(() => {
    setHeadings(headings);
    return () => setHeadings([]);
  }, [headings, setHeadings]);
}

export function useOutline(): Heading[] {
  return useContext(DocumentOutlineContext).headings;
}
