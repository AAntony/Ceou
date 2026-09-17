import { service, reply } from '../_shared/billing-http.ts';
import { verifyAdmobQuery } from '../_shared/admob-signature.mjs';
import { uuid } from '../_shared/revenuecat.ts';
let keys: {keyId: number; pem: string}[] = [];
let loadedAt = 0;
Deno.serve(async (req) => {
  if (req.method !== 'GET') return reply({error:'method_not_allowed'},405);
  try {
    const query = new URL(req.url).search.slice(1);
    if (query.length>8192) throw new Error('invalid_callback');
    const keyId = Number(new URLSearchParams(query).get('key_id'));
    if (Date.now()-loadedAt>6*3600*1000 || !keys.some(k=>k.keyId===keyId)) {
      const res = await fetch('https://www.gstatic.com/admob/reward/verifier-keys.json', {signal:AbortSignal.timeout(5000)});
      if (!res.ok) return reply({error:'keys_unavailable'},503);
      keys = (await res.json()).keys; loadedAt=Date.now();
    }
    const key = keys.find(k=>k.keyId===keyId);
    if (!key) throw new Error('unknown_key');
    const p = verifyAdmobQuery(query,key.pem);
    const user = p.get('user_id') || '', id = p.get('custom_data') || '';
    const timestamp = Number(p.get('timestamp'));
    const unit = Deno.env.get('ADMOB_REWARDED_UNIT') || 'ca-app-pub-9364843473034868/9217315316';
    if (![unit,unit.split('/')[1]].includes(p.get('ad_unit') || '') || !uuid.test(user) || !uuid.test(id)
      || p.get('reward_amount')!=='1' || p.get('reward_item')!=='credit_ia'
      || !Number.isFinite(timestamp) || Math.abs(Date.now()-timestamp)>86400000) throw new Error('invalid_callback');
    const { data, error } = await service().rpc('billing_ad_grant', {
      p_id:id,p_user:user,p_transaction:p.get('transaction_id'),p_test:false,
    });
    if (error) return reply({error:'temporary_failure'},503);
    return reply({credited:!!data});
  } catch { return reply({error:'invalid_callback'},400); }
});
