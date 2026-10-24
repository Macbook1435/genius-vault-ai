// Fail closed on sold-price estimates when an exact catalog parallel is not confirmed.
// Does not alter the raw sold records, which may still be shown for manual review.
export function exactCompsAllowed({ identityTrusted, parallelStatus, serialNumbered, serialConfirmed, printRunMatched }) {
  if (identityTrusted !== true) return false;
  if (parallelStatus !== 'matched') return false;
  if (serialNumbered && (serialConfirmed !== true || printRunMatched !== true)) return false;
  return true;
}
