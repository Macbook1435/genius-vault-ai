# Mixed-card bulk scan import — test branch only

## Goal
Import thousands of unsorted physical sports cards from Fujitsu fi-7160 duplex JPEG scans without manually sorting by brand, set, or rarity. Do not change production until test validation succeeds.

## Input and safeguards
- Select a folder or multiple JPEG files in one action; do not force one-card-at-a-time upload.
- Inspect natural scan order and original filenames. Image Capture names the first file `CDP Football 000.jpeg`, followed by `CDP Football 000 1.jpeg`, etc.; lexicographic filename sorting can put the first file at the end. Pair by parsed numeric suffix / scan sequence, not Finder display order. Confirm actual front/back orientation before final import; never assume every even file is front without checking.
- Warn if odd image count, duplicate image hash, missing counterpart, or ambiguous ordering; do not silently pair or discard.
- Detect incomplete/cropped cards (e.g., narrow image ~770 x 2084 versus typical ~1500 x 2087) and flag for selective rescan, not entire batch rescan. Dimensions are a warning, not proof.
- Preserve originals and image SHA-256. Idempotent retries must not create duplicate physical cards.
- Each physical copy gets its own record and front/back image links; do not conflate checklist entries, variants, and copies.

## Identification
- Infer manufacturer, sport, year, set, player, card number, insert, parallel, serial stamp, autograph/memorabilia from images and verified checklists. Do not require pre-sorting.
- Distinguish known from inferred/unverified fields; return candidate matches for ambiguous parallels. Never fabricate a parallel, print run, or sold price.
- Show batch progress and a compact exception review queue. Save unrecognized cards as pending, not falsely identified.

## Data and security
- Use the **test** Supabase project only. Catalog tables are not a physical collection. Add dedicated user-owned scan batch, physical copy, and image records plus private Storage, with auth.uid()-scoped RLS and no public read/write access.
- Separate staged upload, recognition, review, and commit; confirm saved record count and links before success message.
- Keep production untouched. Test with existing 10-card/20-image batch; ensure cropped first card is flagged and 9 remaining pairs are checked rather than assumed correct.

## Acceptance checks
1. Twenty files can be selected in one action and processed without manual set selection.
2. First unsuffixed file sorts first in acquisition order; exactly 10 candidate pairs are proposed.
3. Cropped front is flagged, and other pairs remain available for review.
4. Duplicate upload does not create 10 additional physical copies.
5. Each saved copy has two correctly matched images and independently verified/unknown identification fields.
6. No writes to production; no public exposure of personal card photos.
