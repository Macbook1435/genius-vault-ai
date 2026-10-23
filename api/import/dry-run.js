export const config = { api: { bodyParser: false } };
import { timingSafeEqual } from 'node:crypto';
import { prepareChecklistImport } from '../_lib/catalog-import-prepare.js';
// Test-only dry run. No database calls, no persistence.
const LIMIT=1024*1024;
function secretMatches(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length>0&&x.length===y.length&&timingSafeEqual(x,y);}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Allow','POST');
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  let project='';
  try{project=new URL(process.env.SUPABASE_URL||'').hostname.split('.')[0];}catch{}
  if(process.env.GV_ENABLE_IMPORT_DRY_RUN!=='1'||project!=='upvklqpoekudqifydmwr'||!process.env.GV_IMPORT_ADMIN_KEY||process.env.GV_IMPORT_ADMIN_KEY.length<32)
    return res.status(503).json({error:'TEST_IMPORT_DISABLED'});
  if(!secretMatches(req.headers['x-gv-import-key'],process.env.GV_IMPORT_ADMIN_KEY))
    return res.status(401).json({error:'UNAUTHORIZED'});
  if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')
    return res.status(415).json({error:'JSON_REQUIRED'});
  try{
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>LIMIT)return res.status(413).json({error:'PAYLOAD_TOO_LARGE'});chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.csvText!=='string'||!body.columnMapping||typeof body.columnMapping!=='object'||Array.isArray(body.columnMapping))
      return res.status(400).json({error:'INVALID_REQUEST'});
    const report=prepareChecklistImport(body.csvText,{columnMapping:body.columnMapping,licenseStatus:body.licenseStatus});
    return res.status(200).json({...report,mode:'dry_run',database_writes:0,license_verified:false});
  }catch(error){
    if(error instanceof SyntaxError||error instanceof TypeError||/CSV|mapping|header|quote|field/i.test(String(error?.message||'')))
      return res.status(400).json({error:'INVALID_CHECKLIST',detail:String(error.message).slice(0,160)});
    return res.status(500).json({error:'DRY_RUN_FAILED'});
  }
}
