import { DocumentStatus } from '@techdocs/shared';

/** One matching document as produced by the engine, before HTTP serialization. */
export interface SearchHit {
  id: string;
  title: string;
  author: string;
  category: string;
  tags: string[];
  version: string;
  status: DocumentStatus;
  fileName: string;
  /** Snippet with `<mark>` around the matched terms. */
  highlight: string;
  rank: number;
  createdAt: Date;
}

export interface SearchPage {
  items: SearchHit[];
  /** Number of matches across all pages. */
  total: number;
}
