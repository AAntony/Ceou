import { caller, failure, reply } from '../_shared/billing-http.ts';
import { syncSubscriber } from '../_shared/revenuecat.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply({});
  if (req.method !== 'POST') return reply({error:'method_not_allowed'},405);
  try {
    const user = await caller(req);
    const body = await req.json().catch(()=>({}));
    if(body.action==='status') return reply({ready:!!Deno.env.get('REVENUECAT_SECRET_KEY')});
    await syncSubscriber(user.id); return reply({ok:true});
  }
  catch (error) { return failure(error); }
});
