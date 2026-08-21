// Interprétation d'une phrase dictée en INTENTION structurée.
//
// PRINCIPE DE CONCEPTION, le plus important de ce fichier : le modèle ne voit
// JAMAIS l'inventaire et ne renvoie JAMAIS d'identifiant de base de données.
// Il traduit une phrase en intention avec des TERMES DE RECHERCHE ; c'est
// l'app qui résout ces termes contre l'index qu'elle a déjà en mémoire.
//
// Trois raisons :
//   - un modèle ne peut pas inventer un identifiant qui n'existe pas ;
//   - on n'envoie pas l'inventaire du domicile de quelqu'un à un tiers, juste
//     sa phrase ;
//   - la résolution devient déterministe, donc testable et reproductible.
//
// Le modèle ne rédige pas non plus la réponse : l'app la compose à partir des
// données réelles. L'assistant ne peut donc pas énoncer à voix haute quelque
// chose que la base n'a pas dit.
//
// Même armature que detect-objects : clé Gemini côté serveur (jamais dans un
// bundle décompilable), JWT vérifié, débit limité pour protéger un quota
// PARTAGÉ entre tous les utilisateurs.

import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI_MODEL = 'gemini-3.6-flash';

// Bien plus court que les 30 s du scan photo : un assistant vocal s'utilise
// naturellement plusieurs fois de suite (« et mes lunettes ? »). Un compteur
// distinct du scan, voir la migration ai_rate_limit_kinds.
const RATE_LIMIT_COOLDOWN_SECONDS = 3;
const RATE_LIMIT_KIND = 'voice';

const MAX_TRANSCRIPT_LENGTH = 300;

const SYSTEM_PROMPT = `Tu analyses une phrase dictée par l'utilisateur d'une application d'inventaire domestique. L'application permet de retrouver où sont rangés des objets, organisés par Habitation > Pièce > Emplacement (meuble) > Conteneur (boîte) > Objet.

Ta seule tâche est de classer la demande et d'en extraire les termes de recherche. Tu n'as AUCUN accès à l'inventaire : n'invente jamais de nom d'objet ou de pièce qui ne serait pas dans la phrase.

Actions possibles :
- "locate" : l'utilisateur cherche où se trouve un objet précis. Ex : "Où sont mes clés ?", "Retrouve-moi le chargeur".
- "list_room" : l'utilisateur veut la liste des objets d'une pièce. Ex : "Liste tous les objets de mon bureau", "Qu'est-ce qu'il y a dans la cuisine ?".
- "search" : une recherche libre, sans pièce ni intention de localisation claire. Ex : "les tournevis".
- "unknown" : la demande ne concerne pas la recherche d'objets, ou est incompréhensible.

Règles d'extraction :
- object_query : le nom de l'objet, au plus près des mots de l'utilisateur, SANS les possessifs ni les articles. "mes clés de voiture" -> "clés de voiture".
- room_query : le nom de la pièce, sans article ni possessif. "mon bureau" -> "bureau".
- Laisse une chaîne vide pour ce qui ne s'applique pas.
- Une demande de DÉPLACEMENT ou de modification ("j'ai rangé X dans Y", "supprime X") doit être classée "unknown" : cette version ne sait que consulter.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    action: { type: 'STRING', enum: ['locate', 'list_room', 'search', 'unknown'] },
    object_query: { type: 'STRING' },
    room_query: { type: 'STRING' },
  },
  required: ['action', 'object_query', 'room_query'],
};

type Intent = {
  action: 'locate' | 'list_room' | 'search' | 'unknown';
  object_query: string;
  room_query: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function parseIntent(rawText: string): Intent {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return { action: 'unknown', object_query: '', room_query: '' };
  }

  const value = raw as Partial<Intent>;
  const action = value.action;
  // On revalide la sortie du modèle plutôt que de lui faire confiance : le
  // schéma de réponse est une consigne, pas une garantie.
  if (action !== 'locate' && action !== 'list_room' && action !== 'search' && action !== 'unknown') {
    return { action: 'unknown', object_query: '', room_query: '' };
  }

  return {
    action,
    object_query: typeof value.object_query === 'string' ? value.object_query.trim() : '',
    room_query: typeof value.room_query === 'string' ? value.room_query.trim() : '',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return jsonResponse({ error: 'missing_api_key' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authHeader || !supabaseUrl || !anonKey) return jsonResponse({ error: 'unauthorized' }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'unauthorized' }, 401);

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) return jsonResponse({ error: 'missing_service_role_key' }, 500);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: allowed, error: rateLimitError } = await serviceClient.rpc('check_and_touch_ai_rate_limit', {
    p_user_id: userData.user.id,
    p_kind: RATE_LIMIT_KIND,
    p_cooldown_seconds: RATE_LIMIT_COOLDOWN_SECONDS,
  });
  if (rateLimitError) {
    console.error('Rate limit check failed', rateLimitError);
    return jsonResponse({ error: 'rate_limit_check_failed' }, 500);
  }
  if (!allowed) return jsonResponse({ error: 'rate_limited', retryAfterSeconds: RATE_LIMIT_COOLDOWN_SECONDS }, 429);

  let body: { transcript?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const transcript = (body.transcript ?? '').trim();
  if (!transcript) return jsonResponse({ error: 'empty_transcript' }, 400);
  // Borne haute : une dictée est une phrase, pas un document. Protège aussi
  // le quota contre un envoi massif.
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) return jsonResponse({ error: 'transcript_too_long' }, 400);

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: transcript }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          // Une classification n'a aucun besoin de créativité, et on veut la
          // même phrase interprétée pareil d'une fois sur l'autre.
          temperature: 0,
        },
      }),
    },
  );

  if (!geminiResponse.ok) {
    console.error('Gemini call failed', geminiResponse.status, await geminiResponse.text());
    return jsonResponse({ error: 'ai_unavailable' }, 502);
  }

  const payload = await geminiResponse.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') return jsonResponse({ error: 'ai_unavailable' }, 502);

  return jsonResponse({ intent: parseIntent(text) });
});
