# Pricing regression verification — 2026-10-11

Branch: `test/cardlists-license-coverage-audit-20261010`

## Executed checks
- Node.js v22.16.0, `node --test early-comps-gate.test.mjs` against locally available copies of the gate and tests: **5 pass, 0 fail**, ~50 ms.
- GitHub source read of `api/scan.js` at blob `13ec0893e574b143e21ae4a7cbfe2df0a3abd6e0`: **5/5 structural regex assertions pass** matching `tests/pricing-flow-regression.test.mjs`:
  1. early broad fetch guarded
  2. numbered unresolved cards blocked from base path
  3. failed catalogue lookup blocked from base path
  4. unresolved variations clear cached comps and block market output
  5. CardSight exact-comps function appears under nonblocked branch
- No paid API calls, no merge, no production changes.

## Limitations
- The five structural assertions were executed against the fetched scanner text in the GitHub tool runtime, not by running the actual `node --test tests/pricing-flow-regression.test.mjs` file in a checked-out repository.
- This is **not** a full offline suite run, integration test, end-to-end production test, or live CardSight API accuracy measurement.
- Known Mason Graham 2025 Donruss Optic Rated Rookies Preview Red Pandora #340 remains a metadata fixture, not a real photo-based benchmark.
- Audit finding for next development: test unresolved base/unnumbered behavior and exceptional paths with mock dependencies rather than relying on regex alone, and ensure final response sold information remains gated.
