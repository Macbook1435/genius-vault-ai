# Third-party source verification — 2026-10-11

Research only. Do not import third-party image datasets or scraped checklists into production.

## GotThatData/sports-cards (Hugging Face)
Source: https://huggingface.co/datasets/GotThatData/sports-cards
- Dataset viewer reports **127 rows**, ~**56.2 MB** total; imagefolder type.
- Repo metadata indicates MIT, but dataset card explicitly separates **metadata (MIT)** from **images (CC BY-NC-SA 4.0)** and cautions that commercial restrictions apply.
- **No commercial reuse approval for images**, including commercial ML training based solely on repository-level MIT badge.
- Metadata rights are described as MIT; verify specific file content, integrity and upstream authorization before any production use. No claim of comprehensive football parallels.
- Recommended next action: inspect schema and sample metadata without ingesting photos; evaluate relevance to local tests only.

## TCDB via API wrappers or scraping
Reference: https://www.tcdb.com/
- TCDB published content terms restrict use of its compilation for commercial purposes and automated extraction, including by third-party software.
- Facts themselves and rights in a particular compilation/contract are different questions. A public facts argument does **not** itself establish permission to systematically collect content through TCDB or intermediaries.
- **Do not use** Apify, Parse.bot, scraping scripts or proxies to bypass conditions absent express documented authorization.

## Manufacturer documents
- Official downloadable Panini and Topps checklists can inform verification where access and use are authorized.
- Public download does not automatically mean commercial database republication or broad automated extraction is licensed.
- Validate provenance, current terms, and the actual checklist format, rather than assuming it contains every print run, parallel, and insert.
- Keep source-file and field-level provenance; any offline parsing must be allowed by relevant terms, with reuse separately checked.

## The Card API
Docs: https://www.thecardapi.com/docs
Pricing: https://www.thecardapi.com/pricing
Terms: https://www.thecardapi.com/terms
- Claims 16.6M+ cards and 332K sets, 15 sports, coverage differs by release.
- **Catalog API is not on its free tier**: Builder add-on $29/month, or included on Pro; free offering is sales searches.
- Free plan is noncommercial with no persistent local storage of API responses.
- Exclude from Genius Vault's free commercial checklist-ingest architecture.

## Decision
Continue first-party fixtures + independently verified, legally usable reference catalog. No new integrations, datasets, credits, subscriptions or merges approved by this research. Preserve the existing product-scoped scanner logic and offline tests.
