// Offline JSON checklist dry-run. Does not connect to Supabase.
import { readFileSync } from 'node:fs';
import { validateChecklist } from '../lib/checklist-import-validation.mjs';
const [input, approvals] = process.argv.slice(2);
if (!input || !approvals) {
  console.error('Usage: node scripts/checklist-dry-run.mjs rows.json approved-sources.json');
  process.exitCode = 2;
} else {
  try {
    const rows = JSON.parse(readFileSync(input, 'utf8'));
    const permittedSources = JSON.parse(readFileSync(approvals, 'utf8'));
    if (!Array.isArray(permittedSources) || !permittedSources.every(x => typeof x === 'string')) throw new Error('approved sources must be a JSON array of URLs');
    const result = validateChecklist(rows, { permittedSources });
    console.log(JSON.stringify({ dryRun: true, accepted: result.accepted.length, rejected: result.rejected.length, rejectionDetails: result.rejected }, null, 2));
    if (result.rejected.length) process.exitCode = 1;
  } catch (error) {
    console.error('Import dry-run failed:', error.message);
    process.exitCode = 2;
  }
}
