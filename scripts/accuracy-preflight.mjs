// GET only. No recognition requests, image uploads, scan reservations, or execution mode.
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export async function preflight({origin, expectedCommit, token, fetcher=fetch}) {
  const url=new URL(origin);
  if(url.protocol!=='https:' || !/^genius-vault-[a-z0-9]+-macbook1435s-projects\.vercel\.app$/.test(url.hostname) || url.pathname!=='/' || url.search || url.hash || url.username || url.password)
    throw new Error('Use an exact, verified TEST preview deployment origin');
  if(!/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error('Pinned commit required');
  if(!token) return {authenticated:false,paidExecutionAllowed:false,costCeilingUsd:0,attemptedScans:0,blockers:['TEST access token missing']};
  const response=await fetcher(new URL('/api/subscription-status?testPreflight=1',url),{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(response.status!==200) return {authenticated:false,httpStatus:response.status,paidExecutionAllowed:false,costCeilingUsd:0,attemptedScans:0,blockers:['TEST preflight denied or unavailable']};
  const result=await response.json();
  if(result.environment!=='preview'||result.branch!=='test/visual-audit-guards-20261025'||result.commit!==expectedCommit||result.authenticated!==true||result.emailVerified!==true)
    throw new Error('TEST deployment/authentication evidence does not match pinned target');
  return {...result,paidExecutionAllowed:false,costCeilingUsd:0,attemptedScans:0};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
    const report=await preflight({...config,token:process.env.GV_TEST_ACCESS_TOKEN});
    writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
  } catch { console.error('TEST preflight failed; paid execution remains blocked.');process.exitCode=1; }
}
