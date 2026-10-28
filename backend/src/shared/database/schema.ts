import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** PostgreSQL `tsvector`; Drizzle has no built-in column type for it. */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

/**
 * Weighted full-text vector maintained by PostgreSQL itself (generated column).
 * Both `spanish_unaccent` (custom text search configuration) and
 * `immutable_array_to_string` are created in `drizzle/0000_init.sql` before this
 * table. The wrapper exists because `array_to_string` is STABLE in PostgreSQL and
 * generated columns require an IMMUTABLE expression.
 */
const searchVectorExpression = sql`
  setweight(to_tsvector('spanish_unaccent', coalesce(title,'')), 'A') ||
  setweight(to_tsvector('spanish_unaccent', coalesce(author,'') || ' ' || coalesce(category,'') || ' ' || immutable_array_to_string(tags,' ')), 'B') ||
  setweight(to_tsvector('spanish_unaccent', coalesce(content,'')), 'C')
`;

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    author: text('author').notNull(),
    category: text('category').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    version: text('version').notNull(),
    format: text('format').notNull(),
    storageKey: text('storage_key').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    status: text('status').notNull(),
    errorMessage: text('error_message'),
    content: text('content'),
    searchVector: tsvector('search_vector').generatedAlwaysAs(searchVectorExpression),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('documents_search_idx').using('gin', table.searchVector)],
);

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
