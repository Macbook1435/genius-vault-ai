# Sports-card catalog research intake (TEST only)

Store incoming research as candidate records before promotion to verified catalog.

## Required identity fields
- manufacturer, release_year, product_name, subset / set_name
- parallel_name, print_run (integer, 1 for 1/1), serial_numbered
- source_type, source_url or user-supplied reference, verification_status
- scope_status (whether this applies to paper, Chrome, autographs, or another subset)
- license_status (separate from factual verification)

## Rules
1. A general color ladder is **not** proof that every card in the release has every parallel.
2. Never infer a particular card's serial stamp from its parallel print run.
3. Never auto-approve a candidate, import it into the canonical catalog, or expose it to production identification.
4. Check manufacturer checklist and subset-specific odds before promoting a record.
5. Preserve variant names: Gold Paper, Gold Chrome Refractor, Gold Mojo and Gold Autograph are distinct.
6. User research is welcome even without a URL, but remains pending until corroborated.
7. Keep imports TEST-only; never run paid recognition or sales lookups during research intake.

## Current intake
- `data/research/2026-bowman-football-parallels.candidates.json`: 11 user-provided numbered ladder candidates, pending verification.
- Chrome / pattern / format claims remain narrative leads until exact subset-level evidence is obtained.
