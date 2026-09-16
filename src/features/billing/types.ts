export type PlanLimits = { homes: number; objects: number; photos: number; voice_seconds: number };
export type BillingSnapshot = {
  plan: 'free' | 'plus'; enforced: boolean; tester: boolean; ads_enabled: boolean;
  reward_photos: number; ads_per_day: number; ads_today: number;
  plans: Record<'free' | 'plus', PlanLimits>;
  inventory: { homes: number; objects: number };
  period: string; resets_at: string; photos_used: number; bonus_remaining: number; voice_seconds_used: number;
};
export type StoreOffer = { id: string; title: string; price: string; period: string | null };
