export type BarcodeLookupResult = {
  title: string | null;
  imageUrl: string | null;
};

const UPCITEMDB_TRIAL_URL = 'https://api.upcitemdb.com/prod/trial/lookup';

/**
 * Free "trial" tier (no API key, ~100 req/day) — enough for MVP testing.
 * Returns null on no match or any error, so a scan that finds nothing
 * degrades to a normal manual entry rather than blocking the user.
 */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<BarcodeLookupResult | null> {
  if (signal?.aborted) return null;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 10_000);
  try {
    const response = await fetch(`${UPCITEMDB_TRIAL_URL}?upc=${encodeURIComponent(code)}`, { signal: controller.signal });
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('code' in data) || data.code !== 'OK' || !('items' in data) || !Array.isArray(data.items)) return null;

    const item = data.items[0];
    if (!item || typeof item !== 'object') return null;
    const imageUrl = Array.isArray(item.images) && typeof item.images[0] === 'string' ? item.images[0] : null;
    return {
      title: typeof item.title === 'string' ? item.title : null,
      imageUrl: imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
