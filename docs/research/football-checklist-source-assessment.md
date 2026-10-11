# Football-specific checklist sources — research only

Date: 2026-10-10. No third-party datasets imported, no paid APIs called.

## Verified public reference websites

1. Panini America official checklist search: https://www.paniniamerica.net/checklist.html
   - Supports Football filter plus year, brand and program choices.
   - Publicly accessible reference; bulk-redistribution and automated-use rights **not verified**.
2. Topps official checklist index: https://www.topps.com/pages/checklists
   - Lists current football checklists for Topps Chrome, Finest, Resurgence, Signature Class and others.
   - Public downloads are **not** proof of sublicensing / redistribution rights.
3. Beckett football checklists: https://www.beckett.com/news/category/beckett-football/checklists-beckett-football/
   - Includes recent releases and subset / insert / parallel detail, including 2025 Panini Prizm and Donruss Optic.
   - Commercial copying or scraping rights **not verified**.
4. TCDB terms: https://www.tcdb.com/TermsOfUse.cfm
   - Site access granted for personal noncommercial use; commercial reuse requires written permission.
   - Automated scraping/data mining prohibited. **Do not scrape TCDB, directly or through unverified proxies.**

## Technical direction

- Existing local checklist structures already handle product-scoped parallel and subset references.
- Do not wire scraped data or unauthorized third-party exports into production.
- Separate free browsing/reference lookup from licensed machine-ingest sources.
- For improved automatic parallel identification, test exact card-number/product/subset agreement, front/back visual evidence, and stamped serial before offering a **verified** designation.
- Avoid forcing the owner to choose among dozens of parallel names; show most likely automatically, disclose uncertainty only where evidence is insufficient.
- Sold comps should remain distinct from checklist metadata. Never claim a sold price is final without valid transaction evidence.
- Keep production unchanged until permissions, provenance, fixture tests, full regression suite, and practical image benchmark all pass.
