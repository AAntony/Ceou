export type AdStage = 'consent' | 'privacy' | 'initialization' | 'load' | 'show';

export function adErrorCode(error: unknown, stage: AdStage): string {
  const failure = error as { message?: unknown; code?: unknown } | null;
  const message = typeof failure?.message === 'string' ? failure.message : '';
  const code = typeof failure?.code === 'string' ? failure.code : '';
  if (/^billing_(ad|ads|consent)_[a-z_]+$/.test(message)) return message;
  const details = `${code} ${message}`;
  if (/network|offline|timed?\s*out|timeout|internet/i.test(details)) return 'billing_ad_network';
  if (stage === 'consent' || stage === 'privacy') {
    if (/publisher misconfiguration|no (?:valid )?consent (?:form|message)|not correctly configured|app(?:lication)?\s*id.*(?:invalid|not found)/i.test(details)) {
      return 'billing_ads_configuration';
    }
    return 'billing_consent_unavailable';
  }
  return 'billing_ad_unavailable';
}

type ConsentProvider = {
  gatherConsent(): Promise<unknown>;
  getConsentInfo(): Promise<{ canRequestAds: boolean }>;
};

export async function requireAdConsent(provider: ConsentProvider, onRecoveredError?: (error: unknown) => void): Promise<void> {
  let refreshFailed = false;
  let refreshError: unknown;
  try {
    await provider.gatherConsent();
  } catch (error) {
    refreshFailed = true;
    refreshError = error;
  }
  // UMP can retain a valid choice after a refresh failure. Only its current
  // canRequestAds result can authorize a request, including demonstration ads.
  const info = await provider.getConsentInfo();
  if (info.canRequestAds) {
    if (refreshFailed) onRecoveredError?.(refreshError);
    return;
  }
  if (refreshFailed) throw new Error(adErrorCode(refreshError, 'consent'), { cause: refreshError });
  throw new Error('billing_consent_required');
}
