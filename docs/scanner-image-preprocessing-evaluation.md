# Scanner image preprocessing evaluation plan (TEST only)

## Keep the original image
Never overwrite or discard the uploaded original. Create derived image variants only for OCR comparison.

## Candidate experiments
1. Original grayscale OCR baseline
2. Bilateral denoise (OpenCV bilateralFilter) on a copy
3. Adaptive threshold (Gaussian, block 15, C 4) on a copy
4. Optional morphological opening on a copy; compare against variant without it
5. Detect overexposed / clipped areas; request a new angle when source detail is irrecoverable

## Acceptance criteria
- Compare recognized card number, player name, serial stamps and logo text against manually verified ground truth.
- Track false positives as well as recall, including ambiguous serial separators.
- Evaluate separate subsets: chrome, matte-black, metallic, patch, die-cut, sleeved/top-loaded.
- Never assume processing removes glare or scratches; bright clipped highlights can erase source information.
- Morphological opening may **remove** thin strokes rather than repair broken text. Do not promote it without benchmarks.
- Do not use grayscale for final parallel-color identification; preserve color image evidence.
- Do not infer physical weight, cardstock point thickness, metal composition, or patch authenticity from a single photo.

## Deployment
Research only. No OpenCV runtime dependency, production endpoint, paid API, or scanner image path changed by this document.
