import { Inject, Injectable } from '@nestjs/common';
import { DocumentStatus } from '@techdocs/shared';
import { sql } from 'drizzle-orm';
import { Database, DRIZZLE } from '../../../shared/database/database.provider';
import { SearchEngine } from '../../domain/ports/search-engine';
import { SearchQuery } from '../../domain/search-query';
import { SearchHit, SearchPage } from '../../domain/search-result';

/** Text search configuration created in `drizzle/0000_init.sql` (spanish + unaccent). */
export const TEXT_SEARCH_CONFIG = 'spanish_unaccent';

export const HIGHLIGHT_START = '<mark>';
export const HIGHLIGHT_END = '</mark>';

/** Options for the content snippet: up to two short fragments around the matches. */
const CONTENT_HEADLINE_OPTIONS =
  'MaxFragments=2, MaxWords=18, MinWords=8, StartSel=<mark>, StopSel=</mark>, FragmentDelimiter= … ';
/** Options for the title fallback: the whole title with every match marked. */
const TITLE_HEADLINE_OPTIONS = 'HighlightAll=true, StartSel=<mark>, StopSel=</mark>';

type SearchRow = {
  id: string;
  title: string;
  author: string;
  category: string;
  tags: string[];
  version: string;
  status: string;
  file_name: string;
  /** ISO-8601 string: raw `execute()` bypasses Drizzle's column mappers, so the SQL formats it. */
  created_at: string;
  rank: number;
  /** `count(*) OVER ()` is a bigint, which node-postgres returns as a string. */
  total: string;
  highlight: string;
  title_highlight: string;
};

/**
 * Full-text search over the generated `search_vector` column (weights: A title,
 * B author/category/tags, C content) using the GIN index `documents_search_idx`.
 *
 * The query is shaped for latency:
 *   1. `q` parses the user text once with `websearch_to_tsquery`, which accepts
 *      the familiar syntax ("quoted phrases", -excluded, OR) and never throws
 *      on unbalanced input, unlike `to_tsquery`.
 *   2. `hits` is the only part that touches every match: index lookup, rank,
 *      sort, window count for the total and LIMIT/OFFSET. It returns ids only.
 *      When the text contains nothing but stopwords the tsquery is empty
 *      (`numnode = 0`); the filter on `q` is evaluated before the join, so the
 *      index is not even consulted and the result is an empty page.
 *      The sort ends with `d.id DESC`: `(rank, created_at)` is not unique
 *      (bulk uploads share a timestamp and equal text ranks equal), and
 *      Postgres returns ties in arbitrary order, so without a unique key a
 *      row could appear on two pages or on none. The outer query repeats the
 *      same three keys so the page keeps the order the window was cut with.
 *   3. The outer SELECT joins the page's rows back to `documents` and only then
 *      runs `ts_headline`, which is expensive (it re-parses the document text).
 *      Running it on at most `pageSize` rows instead of on every match keeps
 *      the cost independent of how many documents match.
 *
 * Highlight fallback: when the match lives in the metadata (title, author,
 * tags) `ts_headline` over the content has no `<mark>`; the hit then uses the
 * title headline instead, so the UI always shows why the document matched.
 */
@Injectable()
export class PostgresSearchEngine implements SearchEngine {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async search(query: SearchQuery): Promise<SearchPage> {
    const result = await this.db.execute<SearchRow>(sql`
      WITH q AS (
        SELECT websearch_to_tsquery(${TEXT_SEARCH_CONFIG}, ${query.q}) AS query
      ),
      hits AS (
        SELECT d.id,
               ts_rank_cd(d.search_vector, q.query) AS rank,
               d.created_at,
               count(*) OVER () AS total
        FROM documents d, q
        WHERE numnode(q.query) > 0
          AND d.status = ${DocumentStatus.INDEXED}
          AND d.search_vector @@ q.query
        ORDER BY rank DESC, d.created_at DESC, d.id DESC
        LIMIT ${query.pageSize} OFFSET ${query.offset}
      )
      SELECT d.id,
             d.title,
             d.author,
             d.category,
             d.tags,
             d.version,
             d.status,
             d.file_name,
             to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
             hits.rank,
             hits.total,
             ts_headline(${TEXT_SEARCH_CONFIG}, coalesce(d.content, ''), q.query, ${CONTENT_HEADLINE_OPTIONS}) AS highlight,
             ts_headline(${TEXT_SEARCH_CONFIG}, d.title, q.query, ${TITLE_HEADLINE_OPTIONS}) AS title_highlight
      FROM hits
      JOIN documents d ON d.id = hits.id, q
      ORDER BY hits.rank DESC, d.created_at DESC, d.id DESC
    `);

    const rows = result.rows;
    if (rows.length === 0 && query.offset > 0) {
      // Past the last page: the window count travelled with the rows, so the
      // total is recomputed (index-only, no ranking or headline) to stay stable.
      return { items: [], total: await this.countMatches(query) };
    }
    return {
      items: rows.map(toHit),
      total: rows.length > 0 ? Number(rows[0].total) : 0,
    };
  }

  private async countMatches(query: SearchQuery): Promise<number> {
    const result = await this.db.execute<{ total: string }>(sql`
      WITH q AS (
        SELECT websearch_to_tsquery(${TEXT_SEARCH_CONFIG}, ${query.q}) AS query
      )
      SELECT count(*) AS total
      FROM documents d, q
      WHERE numnode(q.query) > 0
        AND d.status = ${DocumentStatus.INDEXED}
        AND d.search_vector @@ q.query
    `);
    return Number(result.rows[0]?.total ?? 0);
  }
}

function toHit(row: SearchRow): SearchHit {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    category: row.category,
    tags: row.tags,
    version: row.version,
    status: row.status as DocumentStatus,
    fileName: row.file_name,
    highlight: pickHighlight(row),
    rank: Number(row.rank),
    createdAt: new Date(row.created_at),
  };
}

function pickHighlight(row: SearchRow): string {
  if (row.highlight.includes(HIGHLIGHT_START)) {
    return row.highlight;
  }
  return row.title_highlight;
}
