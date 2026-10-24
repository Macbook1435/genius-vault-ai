// Preview-only CDP import configuration. Never returns service-role credentials.
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(process.env.VERCEL_ENV!=='preview')return res.status(404).json({error:'PREVIEW_ONLY'});
 const url=process.env.SUPABASE_URL||'';
 let hostname='';
 try{hostname=new URL(url).hostname;}catch{}
 if(hostname!=='upvklqpoekudqifydmwr.supabase.co'||!process.env.SUPABASE_ANON_KEY)
   return res.status(503).json({error:'TEST_SUPABASE_CONFIG_MISSING',ready:false});
 return res.status(200).json({ready:true,supabaseUrl:url,supabaseAnonKey:process.env.SUPABASE_ANON_KEY});
}
