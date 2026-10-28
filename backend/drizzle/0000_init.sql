-- Full-text search prerequisites. They must exist before the `documents` table
-- because its generated `search_vector` column references them.
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE TEXT SEARCH CONFIGURATION spanish_unaccent (COPY = spanish);
--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION spanish_unaccent ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
--> statement-breakpoint
-- array_to_string is STABLE; generated columns need IMMUTABLE. For text[] input
-- the result is deterministic, so the wrapper is safe.
CREATE FUNCTION immutable_array_to_string(text[], text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS 'SELECT array_to_string($1, $2)';
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"category" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"version" text NOT NULL,
	"format" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"content" text,
	"search_vector" "tsvector" GENERATED ALWAYS AS (
  setweight(to_tsvector('spanish_unaccent', coalesce(title,'')), 'A') ||
  setweight(to_tsvector('spanish_unaccent', coalesce(author,'') || ' ' || coalesce(category,'') || ' ' || immutable_array_to_string(tags,' ')), 'B') ||
  setweight(to_tsvector('spanish_unaccent', coalesce(content,'')), 'C')
) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "documents_search_idx" ON "documents" USING gin ("search_vector");