import crypto from 'node:crypto';
import {supabaseRequest} from './_lib/subscriptions.js';
export const config={api:{bodyParser:false}};
async function rawBody(req){const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks);}
function verified(payload,header,secret){
 const parts=Object.fromEntries(String(header||'').split(',').map(p=>p.split('=')));
 const ts=Number(parts.t);if(!ts||Math.abs(Date.now()/1000-ts)>300)return false;
 const digest=crypto.createHmac('sha256',secret).update(String(ts)+'.').update(payload).digest('hex');
 return String(header).split(',').filter(p=>p.startsWith('v1=')).some(p=>{const value=p.slice(3);return value.length===digest.length&&crypto.timingSafeEqual(Buffer.from(value),Buffer.from(digest));});
}
async function getSubscription(id){
 const response=await fetch('https://api.stripe.com/v1/subscriptions/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY}});
 if(!response.ok)throw Error('Stripe subscription lookup failed');
 return response.json();
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).end();
 if(!process.env.STRIPE_WEBHOOK_SECRET||!process.env.STRIPE_SECRET_KEY)return res.status(503).end();
 const body=await rawBody(req);
 if(!verified(body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET))return res.status(400).end();
 try{
  const event=JSON.parse(body.toString('utf8'));
  if(!['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))return res.status(200).json({received:true});
  const subscription=await getSubscription(event.data.object.id);
  const userId=subscription.metadata?.gv_user_id;
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(userId||''))return res.status(200).json({received:true});
  const item=subscription.items?.data?.[0];
  const correctPrice=item?.price?.id===process.env.STRIPE_PRICE_ID;
  const periodStart=item?.current_period_start||subscription.current_period_start;
  const periodEnd=item?.current_period_end||subscription.current_period_end;
  const status=correctPrice&&['active','trialing','past_due','canceled'].includes(subscription.status)?subscription.status:'inactive';
  const limit=correctPrice&&['active','trialing'].includes(status)?Number(process.env.GV_MONTHLY_SCAN_LIMIT||0):0;
  await supabaseRequest('/rest/v1/gv_entitlements?on_conflict=user_id',{method:'POST',admin:true,body:{user_id:userId,stripe_subscription_id:subscription.id,status,period_start:periodStart?new Date(periodStart*1000).toISOString():null,period_end:periodEnd?new Date(periodEnd*1000).toISOString():null,scan_limit:Math.max(0,limit),updated_at:new Date().toISOString()}});
  return res.status(200).json({received:true});
 }catch(err){console.error('Subscription webhook failed',err);return res.status(500).end();}
}
