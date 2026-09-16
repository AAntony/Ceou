import { caller, failure, reply, service } from '../_shared/billing-http.ts';
import { uuid } from '../_shared/revenuecat.ts';
Deno.serve(async (req) => {
  if (req.method==='OPTIONS') return reply({});
  if (req.method!=='POST') return reply({error:'method_not_allowed'},405);
  try {
    const user = await caller(req);
    const body = await req.json();
    const db = service();
    if (body.action==='prepare' && typeof body.test==='boolean') {
      const {data,error} = await db.rpc('billing_ad_prepare',{p_user:user.id,p_test:body.test});
      if(error) throw error;
      return reply({id:data});
    }
    if (!uuid.test(body.id || '')) return reply({error:'invalid_body'},400);
    // Only server-allowlisted test accounts may simulate a reward. Production uses SSV only.
    if (body.action==='test_complete') {
      const {data,error} = await db.rpc('billing_ad_grant',{p_id:body.id,p_user:user.id,p_transaction:`test:${body.id}`,p_test:true});
      if(error) throw error;
      return reply({credited:!!data});
    }
    if (body.action==='cancel') {
      const {error} = await db.from('billing_ad_rewards').update({expires_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',user.id).is('granted_at',null);
      if(error) throw error;
      return reply({ok:true});
    }
    if (body.action==='status') {
      const {data,error} = await db.from('billing_ad_rewards').select('granted_at').eq('id',body.id).eq('user_id',user.id).maybeSingle();
      if(error) throw error;
      return reply({credited:!!data?.granted_at});
    }
    return reply({error:'invalid_body'},400);
  } catch(error) { return failure(error); }
});
