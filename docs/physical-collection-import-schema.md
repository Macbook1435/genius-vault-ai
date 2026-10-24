# Physical collection schema design — TEST ONLY

This design is separate from gv_catalog_* (checklist data) and gv_import_* (checklist ingestion). Do not run against production.

## Tables
- gv_collection_batches: id uuid PK, user_id uuid not null, source text, external_batch_id text, created_at; unique(user_id, source, external_batch_id) for retry protection.
- gv_collection_copies: id uuid PK, user_id uuid, batch_id uuid FK, source_row_key text, catalog_card_id uuid nullable, catalog_parallel_id uuid nullable, raw_identification jsonb, status text (pending/verified/needs_review), serial_stamp text nullable; unique(batch_id, source_row_key). One row PER owned physical copy, including identical duplicates.
- gv_collection_copy_images: id uuid PK, user_id uuid, copy_id uuid FK, side text (front/back), storage_path text, content_sha256 text, unique(copy_id, side). Private object storage path scoped to owner.

## Import rules
1. Parse the existing 110-row manifest; verify that every record has exactly one front and back image and preserve original CDP metadata as untrusted raw fields.
2. Authenticate user. Insert one batch using stable external batch ID, then upsert copies by (batch_id, source_row_key); never dedupe by player, parallel or image hash.
3. Store front/back in a PRIVATE Supabase Storage bucket. Confirm ownership for both DB rows and storage object paths. Enable RLS on every exposed table and policies restricting SELECT/INSERT/UPDATE/DELETE to auth.uid() = user_id. Avoid service keys in browser.
4. Reupload of same batch = no added copies. Separate batch of identical physical cards = new copies. Rescan to replace image must target an existing copy ID.
5. Treat blank parallel and unmatched CDP identities as pending review, not base by default.
6. Verify in test: 110 physical copy records, 220 linked images, 0 missing, 57 preliminary identities (not verified catalog identities), no change on retry. Do not claim completion until SQL and storage checks pass.

## Important
This is a design document, not a completed migration or import. The original ZIP and generated manifest must be made available to the execution environment before a real import can be run.
