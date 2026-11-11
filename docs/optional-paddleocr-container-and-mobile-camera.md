# Optional OCR service and mobile camera architecture (TEST design only)

## Existing stack
Preserve existing web scanner, Vercel Preview, Supabase TEST, account login, free scan entitlement and paid execution lock. Do not replace it with a new React Native application without explicit migration approval.

## Optional FastAPI/PaddleOCR service
- Requires a separately provisioned CPU/GPU container host; Vercel serverless is not assumed suitable for a persistent model worker.
- Pin and test Python, PaddlePaddle, PaddleOCR and OpenCV versions together. OCR API parameters differ across versions.
- Use opencv-python-headless; test required Linux shared libraries before adding GUI libraries.
- Model weights may be downloaded during image build after licensing and provenance review. Verify image size, memory, cold start, health checks, timeouts and concurrency.
- Do not copy a local SQLite file as the authoritative catalog; Supabase TEST remains authoritative.
- Require authenticated, rate-limited API calls, size/type validation, secure image retention, and no production secrets in clients.
- TEST paid execution must remain disabled. No external OCR or pricing calls without approved ceilings.

## Mobile camera
- Prefer progressive enhancement of existing mobile web scanner.
- An overlay alone does not measure quality; actual blur, glare and corner-coverage metrics require a working frame processor and device calibration.
- Request camera permissions; show accessible instructions; allow manual capture when automatic gates cannot assess a card.
- Support front/back and open booklet without discarding original images.
- Use actual endpoint routing and verified response schema; do not ship placeholder URL.
- Do not manually force multipart Content-Type with missing boundary.
- Keep flash off by default, but offer safe ambient-light guidance.

## Release gates
1. Inspect repository frontend/framework and current scan endpoint contract.
2. Implement camera UI in existing framework, TEST only.
3. Validate quality-gate measurements on representative real devices/cards.
4. Evaluate local OCR deployment costs and version compatibility.
5. Test auth, entitlement, security, failures, fallback, and catalog verification.
6. Require explicit approval before production deployment.
