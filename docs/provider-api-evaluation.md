# Genius Vault AI — Provider API Evaluation

Status: **evaluation only**. This document is NOT an approved checklist, verified print-run source, or production data feed.

## Objective

Evaluate Card Hedge and The Card API for accurate commercial card identification and licensed catalog use. No subscription or ingestion until source coverage, API responses, licensing, and costs are validated.

## Physical-card benchmark

- Product: **2025 Panini Donruss Football**
- Subset: **Optic Rated Rookies Preview**
- Player: **Mason Graham**
- Card number: **340**
- Parallel: **Red Pandora**, unnumbered (physical-card benchmark)
- Important rejection: **2025 Donruss Optic Football #206** is not this card.
- The back's **PRIZM** marking does not change the product to Panini Prizm.

## Provider response scorecard

| Requirement | Card Hedge | The Card API | Evidence required |
| --- | --- | --- | --- |
| Licensed commercial use and permitted caching | Awaiting response | Awaiting response | Written terms |
| Access to full catalog, not only sales comps | Awaiting response | Awaiting response | Sample API response |
| Product year, manufacturer, brand and sport | Not tested | Not tested | Stable IDs and field values |
| Donruss vs standalone Donruss Optic separation | Not tested | Not tested | Product IDs |
| Subset / insert relationship | Not tested | Not tested | Subset ID and parent product |
| Mason Graham #340, not #206 | Not tested | Not tested | Exact card lookup |
| Red Pandora unnumbered parallel | Not tested | Not tested | Exact variant ID and null print run |
| Separate color, pattern, and serial evidence | Not tested | Not tested | Parallel schema |
| Autograph vs non-autograph variants | Not tested | Not tested | Distinct variant/subset records |
| Missing-card reporting and corrections | Not tested | Not tested | API docs / workflow |
| Rate limits, latency, pricing, redistribution | Awaiting response | Awaiting response | Written commercial terms |

## Candidate checklist entries from user-provided blueprint — UNVERIFIED

The supplied blueprint mentions these possible variants. **Do not import as facts** or infer they belong to Mason Graham #340. Each requires independent manufacturer or appropriately licensed source verification, including correct release and subset scope:

- Unnumbered: Holo, Purple, Scope, Shock, Yellow, Laser and Red Pandora.
- Numbered candidates: Aqua /299, Orange Laser /179, Red Laser /99, Blue Laser /49, Gold Laser /10, Black Laser /1.
- Autograph families: Optic Rated Rookies Preview Autographs, Choice Optic Autographs; possible Green Provisos /99 or less, Holo Autos /49, Gold Autos /10, Gold Vinyl /1.

**Note:** The listed names/ceilings may refer to other products or subsets; do not assume they are applicable to this benchmark.

## Acceptance protocol

1. Confirm developer test access and written commercial licensing before ingesting data.
2. Retrieve raw responses for exact product, subset, card number and parallel. Preserve provider IDs and provenance.
3. Cross-check against independent authorized checklist sources. Reject conflicts rather than choosing the first match.
4. Run offline regression tests for correct product routing and distinct **Gold color** vs **Cracked Ice pattern** evidence; also Red Pandora, Orange Wave and Green Velocity.
5. Treat provider checklist entries as **candidate existence evidence**, never proof that a photographed card has that parallel.
6. Keep missing or uncertain print runs **null**, not zero. Keep unverified prices unknown, not $0.
7. Test on the dedicated branch only. Do not spend user scan credits, purchase subscriptions or change Production without approval.

## Evaluation outcome

**Pending** — no provider API key or verified sample response available. No claims of provider coverage or accuracy are authorized yet.
