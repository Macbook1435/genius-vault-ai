import {authenticatedUser,entitlement,usageCount,subscriptionsEnabled} from './_lib/subscriptions.js';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 res.setHeader('Cache-Control','no-store, private');
 if(!subscriptionsEnabled())return res.status(200).json({enabled:false,checkoutReady:false});
 const user=await authenticatedUser(req);
 if(!user)return res.status(401).json({error:'Sign in required'});
 try{
  const plan=await entitlement(user.id);
  const now=Date.now();
  const start=plan?.period_start?Date.parse(plan.period_start):NaN;
  const end=plan?.period_end?Date.parse(plan.period_end):NaN;
  const active=Boolean(['active','trialing'].includes(plan?.status)&&Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&end>now);
  const used=active?await usageCount(user.id,plan.period_start):0;
  const limit=active?Math.max(0,Number(plan.scan_limit)||0):0;
  return res.status(200).json({
   enabled:true,
   checkoutReady:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID),
   plan,used,remaining:Math.max(0,limit-used),
   allowanceActive:active
  });
 }catch(e){
  console.error('Subscription status lookup failed',e);
  return res.status(503).json({error:'Subscription status unavailable'});
 }
}
