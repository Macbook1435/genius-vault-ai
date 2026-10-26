// TEST-only fail-closed batch admission policy. No API calls are made here.
// Budget is a preflight estimate, NOT an OpenAI or CardSight billing cap.
export function authorizeTestBatch({ environment, scans, approvedMaxScans, estimatedUsdPerScan, approvedUsd, authenticated, externalServicesBounded }) {
  const fail = reason => ({ allowed: false, reason });
  if (environment !== 'test') return fail('TEST environment required');
  if (!authenticated) return fail('Verified TEST authentication required');
  if (!externalServicesBounded) return fail('All external service calls and retries must have enforced limits');
  // An estimated budget cannot cap provider charges. Do not authorize execution.
  // This function is informational preflight only until a provider-enforced ceiling exists.
  if (![scans, approvedMaxScans].every(n => Number.isSafeInteger(n) && n > 0)) return fail('Invalid scan count');
  if (scans > approvedMaxScans) return fail('Batch exceeds approved scan count');
  if (![estimatedUsdPerScan, approvedUsd].every(n => Number.isFinite(n) && n > 0)) return fail('Verified estimate and approved budget required');
  const estimatedTotalUsd = Math.ceil(scans * estimatedUsdPerScan * 100) / 100;
  if (estimatedTotalUsd > approvedUsd) return fail('Estimated cost exceeds approved budget');
  return { allowed: false, reason: 'Preflight estimate passed, but execution remains locked until provider-side limits are verified', estimatedTotalUsd, preflightPassed: true };
}
