export default function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();
 const enabled=process.env.GV_REQUIRE_SUBSCRIPTION==='1';
 const preview=process.env.VERCEL_ENV==='preview';
 return res.status(200).json({
  enabled,
  cdpTestAvailable:preview,
  cdpTestSupabaseUrl:preview?(process.env.SUPABASE_URL||null):null,
  cdpTestSupabaseAnonKey:preview?(process.env.SUPABASE_ANON_KEY||null):null,
  supabaseUrl:enabled?(process.env.SUPABASE_URL||null):null,
  supabaseAnonKey:enabled?(process.env.SUPABASE_ANON_KEY||null):null,
  checkoutReady:enabled&&Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID)
 });
}
