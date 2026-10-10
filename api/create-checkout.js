import {authenticatedUser,subscriptionsEnabled,supabaseRequest} from './_lib/subscriptions.js';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 if(!subscriptionsEnabled())return res.status(503).json({error:'Subscriptions not yet available'});
 if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_PRICE_ID||!process.env.GV_PUBLIC_URL)return res.status(503).json({error:'Checkout not configured'});
 const user=await authenticatedUser(req);
 if(!user||!user.email)return res.status(401).json({error:'Sign in required'});
 try{
  const origin=new URL(process.env.GV_PUBLIC_URL).origin;
  const params=new URLSearchParams({
   mode:'subscription','line_items[0][price]':process.env.STRIPE_PRICE_ID,'line_items[0][quantity]':'1',
   success_url:origin+'/?checkout=success',cancel_url:origin+'/?checkout=canceled',
   client_reference_id:user.id,customer_email:user.email,
   'subscription_data[metadata][gv_user_id]':user.id
  });
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded'},body:params});
  const data=await response.json();
  if(!response.ok||!data.url)return res.status(502).json({error:'Checkout unavailable'});
  return res.status(200).json({url:data.url});
 }catch{return res.status(503).json({error:'Checkout temporarily unavailable'});}
}
