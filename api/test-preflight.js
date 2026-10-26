// Read-only TEST preflight. Never reserves scans, calls AI, or changes billing.
import { authenticatedUser, subscriptionsEnabled } from './_lib/subscriptions.js';
export const TEST_BRANCH = 'test/visual-audit-guards-20261025';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  if (req.method !== 'GET') return res.status(405).json({error:'GET only'});
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== TEST_BRANCH) {
    return res.status(404).json({error:'TEST preflight unavailable'});
  }
  const member = await authenticatedUser(req);
  if (!member || !member.email_confirmed_at) return res.status(401).json({error:'Verified TEST sign-in required'});
  return res.status(200).json({environment:'preview', branch:TEST_BRANCH,
    commit:process.env.VERCEL_GIT_COMMIT_SHA || null, authenticated:true, emailVerified:true,
    scanAuthenticationEnforced:subscriptionsEnabled(),
    recognitionConfigured:Boolean(process.env.OPENAI_API_KEY || process.env.SPECIAL_API_KEY),
    paidExecutionAllowed:false, costCeilingUsd:0, perScanUpperBoundUsd:null,
    blockers:['Provider usage, image-token accounting, retries, and per-scan maximum cost have not been independently verified.'],
    attemptedScans:0, approvalAllowed:false, autoApproved:false});
}
