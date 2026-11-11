# Local OCR and checklist ingestion — TEST implementation specification

Status: experimental; not connected to scanner or production.

## OCR adapter
- PaddleOCR must be version-pinned; API signatures and angle/orientation options differ by release.
- Initialize the model once per worker; run on local CPU/GPU with explicit resource limits.
- Keep original color images and front/back provenance; pass image variants to OCR separately.
- Normalize confidence to 0–100, retain text bounding boxes and engine version, and never infer verification from OCR confidence alone.
- Benchmark reflective foil, serial stamps, dark backgrounds, die-cuts, booklets, and sleeved cards.
- Do not promise sub-150ms latency or zero operating costs.

## Authorized checklist intake
- Accept only licensed, authorized, or otherwise permitted data sources; record permission, attribution, source URL, retrieval time, and release year.
- No arbitrary URL scraper, browser spoofing, or automated scraping of unapproved third-party archives.
- Parse into staging rows with product, year, subset, card number, player(s), team, parallel, print run, and source provenance.
- Reject/hold missing identifiers, collisions, and inconsistent numbering; no silent INSERT OR IGNORE.
- Validate against year-specific manufacturer or authorized checklist records.
- Preview changes and require approval before writes to TEST catalog.
- Supabase TEST is the catalog source of truth; SQLite, if used, is an offline staging artifact only.

## Pipeline boundaries
Camera quality and perspective geometry: experimental, thresholds uncalibrated.
Perceptual hash: candidate duplicate hint only; never a definitive parallel/serial identity cache.
OCR: candidate text only, not a verified card identity.
Catalog: exact, release-specific verified matching required.
Valuation: authorized verified exact-match sold transactions only; no fabricated or default prices.
Production release: requires benchmark pass, security review, CI, and explicit approval.
