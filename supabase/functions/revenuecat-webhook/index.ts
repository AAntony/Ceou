import { timingSafeEqual } from 'node:crypto';
import { failure, reply } from '../_shared/billing-http.ts';
import { syncSubscriber, uuid } from '../_shared/revenuecat.ts';
Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({error:'method_not_allowed'},405);
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const supplied = new TextEncoder().encode(req.headers.get('Authorization') || '');
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) return reply({error:'unauthorized'},401);
  try {
    const body = await req.text();
    if (body.length>65536) return reply({error:'invalid_body'},400);
    const {event} = JSON.parse(body);
    if (event?.type==='TEST') return reply({ok:true});
    const ids = [...new Set([event?.app_user_id,...(event?.aliases || []),...(event?.transferred_from || []),...(event?.transferred_to || [])])]
      .filter((id): id is string => typeof id==='string' && uuid.test(id));
    if (ids.length>20) return reply({error:'invalid_body'},400);
    for (const id of ids) await syncSubscriber(id);
    return reply({ok:true});
  } catch(error) { return failure(error); }
});
