import {authenticatedUser,entitlement,usageCount,subscriptionsEnabled} from './_lib/subscriptions.js';
import {trialAllowance,TRIAL_PERIOD_START} from './_lib/trial-policy.mjs';
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
  const emailVerified=Boolean(user.email_confirmed_at);
  const trialUsed=await usageCount(user.id,TRIAL_PERIOD_START);
  const trial=trialAllowance({emailVerified,used:trialUsed});
  const used=active?await usageCount(user.id,plan.period_start):trial.used;
  const unlimited=active&&plan?.unlimited_scans===true;
  const limit=active?Math.max(0,Number(plan.scan_limit)||0):trial.limit;
  return res.status(200).json({
   enabled:true,
   checkoutReady:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID),
   plan,used,unlimitedScans:unlimited,remaining:unlimited?null:Math.max(0,limit-used),
   allowanceActive:active||trial.eligible,
   trial:{emailVerified,used:trial.used,limit:trial.limit,remaining:trial.remaining,requiresEmailVerification:trial.requiresEmailVerification}
  });
 }catch(e){
  console.error('Subscription status lookup failed',e);
  return res.status(503).json({error:'Subscription status unavailable'});
 }
}
