# Offline adapter test execution — 2026-10-11

Executed Node.js v22.16.0 locally using a copy of the GitHub adapter and test module (direct container-to-GitHub downloads unavailable).

Command: `node --test tests/external-observation-adapter.test.mjs`

Result: **7 tests, 7 passed, 0 failed**, ~69.77 ms.

Coverage: football candidate, invalid year, OCR number mismatch, conflicting autograph, non-football exclusion, exclusion of price/image/OCR payload, batch audit counts.

Scope limitations:
- Only synthetic fixtures were executed.
- This is *not* a production scanner test, Postgres integration test, or GitHub CI result.
- Hugging Face `metadata/cards.json` could not be downloaded in this execution environment; no verified football record count or parallel coverage distribution calculated.
- No paid API calls, images imported, or production changes.
