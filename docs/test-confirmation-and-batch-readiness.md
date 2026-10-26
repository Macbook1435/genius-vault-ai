# TEST confirmation policy and accuracy batch readiness

Scope: `test/visual-audit-guards-20261025` only. No production promotion,
billing changes, database writes, or card approvals.

## Behavior

The final response reconciler runs after legacy/catalog promotions. It preserves
raw scan candidates while keeping physical parallels unconfirmed. The current
scanner has no independent physical-parallel verification path, so it cannot
issue a verified valuation. Candidate identity evidence remains separately
available; missing/conflicting visible identity evidence downgrades identity
fields, confidence, and overall status. Both pipeline versions, their summaries,
the overall verification status, and price summaries follow the same restriction.

Selecting a catalog version sets an unverified search candidate. Its sold records
are returned as `referenceSales` and shown in a separate comparison section.
Selection never confirms the parallel, invents a serial, unlocks listing gates,
or populates the verified valuation contract. Audit issues are visible in the UI.
The comparison endpoint retains catalog membership validation and uses the
existing sign-in enforcement flag; it does not modify subscription configuration.

## Batch preparation

Run `python3 scripts/prepare-accuracy-batch.py --archive ORIGINAL.zip
--manifest batch_110_manifest.csv --output accuracy-batch-110.json` on one line.
It requires exactly 110 unique original IDs, 220 exactly matching front/back
filenames, matching SHA-256 hashes, and JPEG signatures. It does not upload
images or access a network. Imported CDP labels remain explicitly unverified;
none are treated as accuracy ground truth or approved automatically.

The original user ZIP and prepared private manifest stay outside this public
repository. The existing Library files remain the source of the image bytes.

Suggested first paid pilot, once separately enabled: 5 cards, concurrency 1,
no automatic retries. No paid runner is enabled by this change. The enforced
execution ceiling is USD 0. A guessed per-card cost is not a budget guarantee:
recognition models, input image tokenization, output caps, provider requests,
and SDK retries need a verified upper bound before any positive ceiling.

## Authentication preflight

`GET /api/test-preflight` is available only on the exact TEST branch in Preview.
It requires a server-validated user with confirmed email. It never reserves an
allowance, submits an image, calls a paid provider, or changes billing. It reports
the deployed SHA and whether the scan's existing authentication flag is enforced.
It always reports paid execution disabled and a zero cost ceiling.

`scripts/accuracy-preflight.mjs` accepts a JSON configuration with `origin` (an
exact immutable Preview deployment origin) and `expectedCommit` (40-char SHA),
and reads the user access token only from `GV_TEST_ACCESS_TOKEN`. It follows no
redirects, requires the correct branch/environment/commit and verified sign-in,
and cannot submit scans. Usage: `node scripts/accuracy-preflight.mjs config.json
report.json` on one line. Never place tokens in config, reports, or source control.
Vercel deployment protection and application sign-in are separate checks. A
Vercel sign-in wall is not proof that application authentication succeeded.

## Validation

`node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`

`python3 tests/prepare-accuracy-batch.test.py`

The offline workflow now runs on this TEST branch and PRs, including focused
catalog/pricing, response-policy, endpoint, preflight, UI, and batch tests. It
also runs collection and verification browser tests with mocked providers.
Real-photo accuracy remains unmeasured until independent labels and scan outputs
exist. Never count agreement with imported CDP labels as accuracy.
