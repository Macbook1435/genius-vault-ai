# Free checklist source evaluation — 2026-10-10

Status: research only; **NOT APPROVED FOR AUTOMATIC IMPORT**.

## Existing Genius Vault implementation reviewed
- `api/scan.js`: scan pipeline and candidate sold-title audit.
- `api/_lib/checklist-registry.js`: product + subset matching, ambiguity handling.
- `api/_lib/catalog-reference.js`: seven existing 2025 product references, scoped lookup and provenance.
- `tests/offline.test.mjs`: offline match/rejection regression tests.
- `tools/accuracy/fixtures/mason-graham-red-pandora.json`: owner-confirmed physical-card reference, NOT a live image-inference benchmark.

## Candidate: robert-porter/CardLists
Source: https://github.com/robert-porter/CardLists

- Verified repository root LICENSE: MIT License, copyright (c) 2025 JunkWaxData.
- Verified README explicitly licenses JSON files as MIT and allows use in applications with attribution.
- License requires preserving the copyright and license notice in copies or substantial portions.
- README currently describes baseball datasets; football and other sports are future expansion goals.
- JSON schema describes sets, cards, variations, parallels, numbering and insert odds; these are **supported field types**, not proof of extensive populated datasets.
- Actual 2025 football or Mason Graham Red Pandora coverage has **NOT** been verified.
- MIT grant applies to material that the licensor owns or has rights to sublicense; independently sourced images, marks, and data with separate restrictions need additional review.
- No sold-transaction data or verified exact sale prices established from this project.
- No data have been copied or imported by this audit.

## Other candidates
- cardtechie/open-checklist-project: README says data Creative Commons (TBD), schema/code MIT. **Do not import data until an actual data license is published.**
- TravisGibbs/SportsCardToolLib: Apache-2.0 code license; this does not establish permission for scraped upstream content. **No import approval.**
- iammike/sports-card-checklists: MIT application code with user-owned Gist data; does not establish broad reusable sports-card catalog coverage.

## Proposed next test gates
1. Enumerate CardLists file paths and count real populated year/sport/product/parallel/card-number rows; never assume schema implies coverage.
2. Validate every selected JSON file against the upstream schema and a local stricter normalized schema.
3. Keep raw source attribution, source commit SHA, source license, and row-level provenance.
4. Import only into an isolated experimental dataset; no changes to production `PRODUCTS` or scanner behavior until reviewed.
5. Compare external matches against existing checklist identity, requiring exact manufacturer/product/year/subset/number where available; contradictions remain unconfirmed.
6. Run existing offline tests and add deterministic negative tests for Mason Graham #340 vs #206, 2025 Donruss Football vs 2025 Donruss Optic, PRIZM finish vs product, Red Pandora vs generic red, uncertain print run, autos, inserts, and mismatched sold comps.
7. Run image-level accuracy benchmark on owner-provided photographs separately from fixture metadata tests.
8. Merge only after tests and coverage/license audit pass. No paid APIs/subscriptions.

## Execution
- Audit-only branch, no production feature toggles.
- Tests not executed by this document change.
- No merge permitted on audit alone.
