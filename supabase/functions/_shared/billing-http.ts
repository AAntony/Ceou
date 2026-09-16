import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
export function service() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}
export async function caller(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  if (!token) throw new Error('unauthorized');
  const { data, error } = await service().auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) throw new Error('unauthorized');
  return data.user;
}
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as {message?: string})?.message ?? 'unavailable');
  const known = /^(unauthorized|billing_[a-z_]+)$/.test(message) ? message : 'billing_unavailable';
  console.error('Billing request failed', known);
  return reply({ error: known }, known === 'unauthorized' ? 401 : known.endsWith('_limit') ? 429 : 503);
}
