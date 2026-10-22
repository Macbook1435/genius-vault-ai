# Card Catalog Expansion Plan — Test Branch Only

## Goal
Build a verified, searchable sports-card catalog independently of marketplace pricing providers. Accuracy first; reliability second; speed third.

## Current verified implementation state
- The checklist generator is `tools/checklists/build.mjs`.
- Product configuration is stored under `tools/checklists/products/`.
- Source text files are stored under `tools/checklists/sources/`.
- Generated product registries live under `api/_data/checklists/`.
- Eight 2025 product configurations are registered. Registration does NOT imply complete card-level or parallel coverage.
- The 2025 Panini Absolute Football configuration includes Rookie Force number format but no independently verified parallel sources.

## Proposed Supabase schema (design only; do not migrate production)
1. `catalog_products`: id, manufacturer, brand, product, sport, release_year, source_status, created_at, updated_at.
2. `catalog_subsets`: id, product_id, subset_name, card_number_pattern, verified_source_count.
3. `catalog_cards`: id, subset_id, card_number, player_name, team, rookie, autograph, memorabilia, identity_status.
4. `catalog_parallels`: id, subset_id, parallel_name, color, finish, numbered_to, verification_status.
5. `catalog_sources`: id, publisher, source_url, license_basis, fetched_at, content_hash, verification_status.
6. `catalog_evidence`: card_id nullable, parallel_id nullable, source_id, claim_type, claim_value, observed_at.
7. `catalog_import_jobs`: id, source_id, status, rows_seen, rows_accepted, rows_rejected, error_summary, started_at, finished_at.

## Integrity and no-guessing rules
- Do not mark a card or parallel verified solely because an AI model inferred it.
- Preserve raw source claims and disagreements. Never silently overwrite conflicts.
- Enforce uniqueness on normalized product/year/sport, subset within product, and card number within subset where applicable.
- Distinguish unknown print run from unnumbered print run.
- Preserve source URL, date, and permitted usage for every imported record.
- Do not scrape or bulk retain marketplace data without a documented legal/licensing basis.
- Do not claim that eight registered products means eight complete checklists.
- No live Supabase migration or production deployment without separate review and approval.

## Implementation phases
1. Inspect existing Supabase schema and permissions in the **test** project; avoid changing production.
2. Draft additive SQL migration and rollback script; validate against isolated test data.
3. Build import validator with duplicate, conflicting source, and unlicensed-source quarantine.
4. Import one legally permitted checklist as a small pilot and compare exact-card matches against known physical cards.
5. Add read-only catalog lookup to test scanner, returning confirmed / needs-review / unknown with evidence.
6. Benchmark parallel detection and exact sold-comps matching independently.
7. Expand by product only after automated regression tests pass.

## eBay integration gate
The original eBay developer registration is rejected and a review request was submitted. Do not assume API approval, access to completed-sales records, permission to derive statistics, or permission to build a permanent catalog from eBay data. Keep eBay pricing as an optional, separately authorized adapter.

## Success criteria for pilot
- Every confirmed attribute links to at least one permitted reference.
- No source-free parallel is shown as verified.
- Duplicate and contradictory records are flagged for review.
- No writes to production services or production branch.
