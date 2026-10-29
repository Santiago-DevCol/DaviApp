ALTER TABLE "documents" ADD COLUMN "document_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "content_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "is_latest" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Backfill the identity of pre-versioning rows. Must match buildDocumentKey()
-- (backend/src/documents/domain/document-key.ts): strip accents, lowercase,
-- collapse any whitespace run to one space, trim. Whitespace is collapsed
-- before btrim so a leading tab/newline is removed like String.prototype.trim.
-- content_hash stays '' (the original bytes are not re-read) and is_latest
-- defaults to true: every existing row is its own latest version.
UPDATE documents
SET document_key = btrim(regexp_replace(lower(unaccent(title)), '\s+', ' ', 'g'))
                   || '|' ||
                   btrim(regexp_replace(lower(unaccent(author)), '\s+', ' ', 'g'))
WHERE document_key = '';--> statement-breakpoint
CREATE INDEX "documents_key_latest_idx" ON "documents" USING btree ("document_key") WHERE "documents"."is_latest";--> statement-breakpoint
CREATE INDEX "documents_key_hash_idx" ON "documents" USING btree ("document_key","content_hash");