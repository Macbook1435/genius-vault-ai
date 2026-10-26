import { authenticatedUser } from './_lib/subscriptions.js';

// TEST-only, read-only readiness endpoint. Never starts a scan or calls paid providers.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required' });
  }
  // Explicit project allowlist; do not trust a client-provided environment label.
  const supabaseUrl = process.env.SUPABASE_URL || '';
  let projectHost = '';
  try { projectHost = new URL(supabaseUrl).hostname; } catch {}
  if (projectHost !== 'upvklqpoekudqifydmwr.supabase.co') {
    return res.status(403).json({ error: 'Isolated TEST Supabase project not verified', batchEnabled: false });
  }
  const user = await authenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Valid TEST bearer session required', batchEnabled: false });
  return res.status(200).json({
    authenticated: true,
    testProjectVerified: true,
    requestedCards: 110,
    imagePairsValidatedInThisRequest: false,
    providerCostCeilingVerified: false,
    batchEnabled: false,
    paidRequestsSubmitted: 0,
    nextStep: 'Verify image manifest, enforce provider cost limits, and obtain explicit paid-scan approval'
  });
}
