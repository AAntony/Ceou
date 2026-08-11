type UpcItemDbItem = {
  title?: string;
  images?: string[];
};

type UpcItemDbResponse = {
  code: string;
  items?: UpcItemDbItem[];
};

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
export async function lookupBarcode(code: string): Promise<BarcodeLookupResult | null> {
  try {
    const response = await fetch(`${UPCITEMDB_TRIAL_URL}?upc=${encodeURIComponent(code)}`);
    if (!response.ok) return null;

    const data: UpcItemDbResponse = await response.json();
    if (data.code !== 'OK' || !data.items?.length) return null;

    const item = data.items[0];
    return {
      title: item.title ?? null,
      imageUrl: item.images?.[0] ?? null,
    };
  } catch {
    return null;
  }
}
