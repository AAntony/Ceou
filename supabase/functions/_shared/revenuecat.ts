import { service } from './billing-http.ts';
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fetch canonical current state; do not infer entitlement from client purchase results. */
export async function syncSubscriber(userId: string) {
  if (!uuid.test(userId)) throw new Error('unauthorized');
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) throw new Error('billing_configuration_pending');
  const checkedAt = new Date().toISOString();
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('billing_provider_unavailable');
  const { subscriber } = await response.json();
  if (!subscriber || typeof subscriber.entitlements !== 'object') throw new Error('billing_provider_unavailable');
  const entitlement = subscriber.entitlements[Deno.env.get('REVENUECAT_ENTITLEMENT') || 'ceou_plus'];
  const subscription = entitlement && subscriber.subscriptions?.[entitlement.product_identifier];
  const expires = entitlement?.expires_date;
  // Plus is a subscription. Missing/invalid expiry or store metadata never grants access.
  const active = typeof expires === 'string' && Number.isFinite(Date.parse(expires)) && typeof subscription?.is_sandbox === 'boolean';
  const db = service();
  const { error } = await db.rpc('billing_entitlement_sync', {
    p_user: userId, p_sandbox: active ? subscription.is_sandbox : false,
    p_expires: active ? expires : '1970-01-01T00:00:00Z', p_checked: checkedAt,
  });
  if (error) throw error;
}
