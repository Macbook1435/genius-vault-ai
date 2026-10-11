// Lifetime free trial. The database RPC must enforce this atomically.
export const FREE_SIGNUP_SCANS = 0;
export const FREE_VERIFIED_TOTAL = 4;
export const TRIAL_PERIOD_START = '2000-01-01T00:00:00Z';
export function trialAllowance({emailVerified=false,used=0}={}) {
 if(!Number.isSafeInteger(used)||used<0)throw new RangeError('Invalid trial usage');
 const limit=emailVerified?FREE_VERIFIED_TOTAL:0;
 return {limit,used,remaining:Math.max(0,limit-used),eligible:emailVerified&&used<limit,
  requiresEmailVerification:!emailVerified};
}
