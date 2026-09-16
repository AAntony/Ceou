// Proxy vers l'API Gemini pour la détection d'objets sur une photo. La clé
// GEMINI_API_KEY ne doit JAMAIS être exposée au client (app distribuable,
// décompilable) — c'est tout l'intérêt de passer par une Edge Function
// plutôt qu'un appel direct depuis Ceou. La vérification JWT par défaut de
// Supabase (verify_jwt, non désactivée ici) garantit que seul un
// utilisateur connecté peut consommer le quota Gemini de ce projet.
//
// Cette clé est UNIQUE et PARTAGÉE entre tous les utilisateurs de l'app
// (voir discussion Lead Dev) — RATE_LIMIT_COOLDOWN_SECONDS protège ce quota
// commun contre un utilisateur (volontaire ou par bug client) qui
// spammerait le scan et grillerait le tier gratuit pour tout le monde.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { reply as jsonResponse } from '../_shared/billing-http.ts';

const GEMINI_MODEL = 'gemini-3.6-flash';
const MAX_DETECTIONS = 25;
const RATE_LIMIT_COOLDOWN_SECONDS = 30;

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

// box_2d de Gemini = [yMin, xMin, yMax, xMax] normalisé 0..1000 — converti
// ici en {x, y, width, height} relatif 0..1 (même convention que rel_x/
// rel_y déjà utilisée par les pastilles du Plan, voir plan_pins) : le reste
// de l'app n'a jamais besoin de connaître le format propre à Gemini.
function parseDetections(rawText: string): Detection[] {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new Error('invalid_provider_response');
  }
  if (!Array.isArray(raw)) throw new Error('invalid_provider_response');

  return raw
    .filter(
      (item): item is { label: string; box_2d: number[] } =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).label === 'string' &&
        Array.isArray((item as Record<string, unknown>).box_2d) &&
        (item as { box_2d: unknown[] }).box_2d.length === 4 &&
        (item as { box_2d: unknown[] }).box_2d.every((n) => typeof n === 'number' && Number.isFinite(n)),
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
  if (req.method === 'OPTIONS') return jsonResponse({});
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return jsonResponse({ error: 'missing_api_key' }, 500);
  }

  // Résout l'utilisateur appelant à partir du header Authorization déjà
  // vérifié par la plateforme (verify_jwt) — un client Supabase construit
  // avec CE header (pas la clé anon seule) permet à auth.getUser() de le
  // décoder/valider et de nous donner l'id fiable de l'utilisateur.
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authHeader || !supabaseUrl || !anonKey) return jsonResponse({ error: 'unauthorized' }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous) return jsonResponse({ error: 'unauthorized' }, 401);

  // check_and_touch_ai_scan_rate_limit n'a aucune policy client (RLS
  // bloque tout) — appelée ici via le client service_role, qui bypass RLS,
  // exactement le cas d'usage prévu pour cette clé (jamais exposée au
  // client, disponible par défaut à toute Edge Function Supabase).
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) return jsonResponse({ error: 'missing_service_role_key' }, 500);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: allowed, error: rateLimitError } = await serviceClient.rpc('check_and_touch_ai_scan_rate_limit', {
    p_user_id: userData.user.id,
    p_cooldown_seconds: RATE_LIMIT_COOLDOWN_SECONDS,
  });
  if (rateLimitError) {
    console.error('Rate limit check failed', rateLimitError);
    return jsonResponse({ error: 'rate_limit_check_failed' }, 500);
  }
  if (!allowed) return jsonResponse({ error: 'rate_limited', retryAfterSeconds: RATE_LIMIT_COOLDOWN_SECONDS }, 429);

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const { imageBase64, mimeType } = body;
  if (typeof imageBase64 !== 'string' || imageBase64.length > 8_000_000 || !['image/jpeg','image/png','image/webp'].includes(mimeType || '')) return jsonResponse({ error: 'invalid_image' }, 400);

  const {data: reservation, error: quotaError} = await serviceClient.rpc('billing_photo_reserve',{p_user:userData.user.id});
  if (quotaError) return jsonResponse({error: quotaError.message === 'billing_photo_limit' ? 'billing_photo_limit' : 'quota_unavailable'}, quotaError.message === 'billing_photo_limit' ? 429 : 503);
  try {

  const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45000),
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
    throw new Error(`provider_${geminiRes.status}`);
  }

  const geminiJson = await geminiRes.json();
  const rawText: string | undefined = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
  const detections = rawText ? parseDetections(rawText) : [];
  if (!rawText) throw new Error('empty_provider_response');
  const usage = geminiJson.usageMetadata;
  const {error: settlementError} = await serviceClient.rpc('billing_photo_settle', {p_id:reservation,p_success:true,p_input:usage?.promptTokenCount ?? null,p_output:usage?.candidatesTokenCount ?? null,p_model:GEMINI_MODEL});
  if (settlementError) console.error('Photo usage settlement failed', settlementError.code);

  return jsonResponse({ detections });
  } catch {
    await serviceClient.rpc('billing_photo_settle',{p_id:reservation,p_success:false});
    return jsonResponse({error:'detection_failed'},502);
  }
});
