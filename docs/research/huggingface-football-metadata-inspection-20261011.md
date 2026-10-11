# Hugging Face GotThatData — actual metadata inspection, 2026-10-11

Source: https://huggingface.co/datasets/GotThatData/sports-cards
Metadata file: https://huggingface.co/datasets/GotThatData/sports-cards/raw/main/metadata/cards.json
Dataset card: https://huggingface.co/datasets/GotThatData/sports-cards

## Findings from the actual file (metadata-only, read via public web)
- `metadata/cards.json` (2.37 MB) reports `totalCards: 1473`, exportDate `2025-01-06T12:54:12.894Z`.
- The Hugging Face imagefolder viewer separately reports 127 *image* rows; do not conflate viewer rows with the JSON metadata record count.
- Observed football examples: Tank Bigsby 2023 Panini Absolute Football No. 131; C.J. Stroud 2023 Panini Illusions Football No. 14; Puka Nacua 2023 Panini Prizm Football No. 357; Jordan Addison 2023 Panini Origins Football RJJ-JA; Brian Robinson Jr. 2021 Panini Select Football #410.
- Fields observed: `id`, `playerName`, `team`, `year`, `manufacturer`, `set`, `cardNumber`, `attributes`, `frontImage`, `backImage`, `aiInsight`, `extractedData.frontOcrText`, `backOcrText`, `frontOcrConfidence`, `backOcrConfidence`, `aiAttributes`, `exportTimestamp`.
- Source metadata *claims* AI verification but observed examples show problems: one record has year `68`; one Jon Cryer record has `On-Card Auto` attributes but describes an unsigned proof. Thus source records must not be treated as verified truth.
- Searches of the raw file returned no exact mentions of `Mason Graham` or `2025 Donruss`. The export predates the 2025 football season.
- `stats.json` separately reports `totalCards: 0` (stale/inconsistent); do not use that as a reliable count.
- Metadata is labeled MIT but source terms also warn commercial restrictions and image licenses CC BY-NC-SA 4.0; image ingest prohibited pending rights approval. No bulk metadata import approved pending provenance verification.
- This is a collection of observed cards, **not** a product-complete catalog of parallel variations and inserts.

## Next safe action
- Write schema-only source adapter with offline synthetic fixtures and deterministic validation, no live external calls or image imports.
- Isolate conflicting OCR vs attributes; require year 1880–2100 and explicit source provenance; do not use source-estimated market values as sold comps.
- Measure football record coverage with reproducible stats only if metadata bytes can be retrieved and audited, while retaining source terms.
- Keep production untouched; no paid credits, no merge.
