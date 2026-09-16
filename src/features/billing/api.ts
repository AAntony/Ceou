import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';
import type { BillingSnapshot } from './types';
export async function billingRequest<T>(fn: string,body: Record<string,unknown> = {}): Promise<T> {
  const {data,error} = await supabase.functions.invoke<T>(fn,{body});
  if(error) {
    if(error instanceof FunctionsHttpError) {
      const response = await error.context.clone().json().catch(()=>null);
      if(typeof response?.error==='string') throw new Error(response.error);
    }
    throw error;
  }
  return data as T;
}
export async function snapshot(): Promise<BillingSnapshot> {
  const {data,error} = await supabase.rpc('billing_snapshot');
  if(error) throw error;
  return data as unknown as BillingSnapshot;
}
