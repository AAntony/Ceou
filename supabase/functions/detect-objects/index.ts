// Proxy vers l'API Gemini pour la détection d'objets sur une photo. La clé
// GEMINI_API_KEY ne doit JAMAIS être exposée au client (app distribuable,
// décompilable) — c'est tout l'intérêt de passer par une Edge Function
// plutôt qu'un appel direct depuis Ceou. La vérification JWT par défaut de
// Supabase (verify_jwt, non désactivée ici) garantit que seul un
// utilisateur connecté peut consommer le quota Gemini de ce projet.

const GEMINI_MODEL = 'gemini-3.6-flash';
const MAX_DETECTIONS = 25;

const DETECTION_PROMPT = `Détecte tous les objets physiques distincts et déplaçables visibles sur cette photo, dans le but de les cataloguer dans une application d'inventaire domestique. Ignore les murs, sols, plafonds, personnes, animaux et éléments de décor fixes (prises électriques, interrupteurs...). Pour chaque objet, donne un court label descriptif en français (2 à 4 mots, capitalisé comme un nom propre d'objet, ex: "Tasse bleue") et sa bounding box. Ne détecte pas plus de ${MAX_DETECTIONS} objets ; si plusieurs objets identiques se touchent (ex: une pile de livres identiques), regroupe-les en une seule détection plutôt que d'en créer une par unité.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      label: { type: 'STRING' },
      box_2d: { type: 'ARRAY', items: { type: 'INTEGER' } },
    },
    required: ['label', 'box_2d'],
  },
};

type Detection = { label: string; box: { x: number; y: number; width: number; height: number } };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// box_2d de Gemini = [yMin, xMin, yMax, xMax] normalisé 0..1000 — converti
// ici en {x, y, width, height} relatif 0..1 (même convention que rel_x/
// rel_y déjà utilisée par les pastilles du Plan, voir plan_pins) : le reste
// de l'app n'a jamais besoin de connaître le format propre à Gemini.
function parseDetections(rawText: string): Detection[] {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (item): item is { label: string; box_2d: number[] } =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).label === 'string' &&
        Array.isArray((item as Record<string, unknown>).box_2d) &&
        (item as { box_2d: unknown[] }).box_2d.length === 4 &&
        (item as { box_2d: unknown[] }).box_2d.every((n) => typeof n === 'number'),
    )
    .slice(0, MAX_DETECTIONS)
    .map((item) => {
      const [yMin, xMin, yMax, xMax] = item.box_2d;
      return {
        label: item.label,
        box: {
          x: Math.max(0, xMin / 1000),
          y: Math.max(0, yMin / 1000),
          width: Math.max(0, (xMax - xMin) / 1000),
          height: Math.max(0, (yMax - yMin) / 1000),
        },
      };
    })
    .filter((d) => d.box.width > 0.01 && d.box.height > 0.01);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return jsonResponse({ error: 'missing_api_key' }, 500);
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const { imageBase64, mimeType } = body;
  if (!imageBase64 || !mimeType) return jsonResponse({ error: 'missing_image' }, 400);

  const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: DETECTION_PROMPT }, { inlineData: { mimeType, data: imageBase64 } }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!geminiRes.ok) {
    console.error('Gemini API error', geminiRes.status, await geminiRes.text());
    return jsonResponse({ error: 'detection_failed' }, 502);
  }

  const geminiJson = await geminiRes.json();
  const rawText: string | undefined = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
  const detections = rawText ? parseDetections(rawText) : [];

  return jsonResponse({ detections });
});
