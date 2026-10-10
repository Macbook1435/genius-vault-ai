import {authenticatedUser,entitlement,usageCount,subscriptionsEnabled} from './_lib/subscriptions.js';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 if(!subscriptionsEnabled())return res.status(200).json({enabled:false,checkoutReady:false});
 const user=await authenticatedUser(req);
 if(!user)return res.status(401).json({error:'Sign in required'});
 try{
  const plan=await entitlement(user.id);
  const used=await usageCount(user.id,plan?.period_start);
  return res.status(200).json({enabled:true,checkoutReady:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID),plan,used,remaining:Math.max(0,(plan?.scan_limit||0)-used)});
 }catch{return res.status(503).json({error:'Subscription status unavailable'});}
}
