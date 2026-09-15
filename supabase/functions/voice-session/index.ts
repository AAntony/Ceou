// Ouverture et clôture d'une conversation vocale temps réel (Gemini Live).
//
// L'APP PARLE DIRECTEMENT À GEMINI, PAS À TRAVERS NOUS. Relayer l'audio par
// une fonction Edge ajouterait de la latence à chaque syllabe et buterait sur
// la durée maximale d'exécution. On délivre donc un JETON ÉPHÉMÈRE : à usage
// unique, valable une minute pour ouvrir la session, et surtout VERROUILLÉ —
// modèle, voix, consignes et outils sont fixés ici. Un client modifié peut
// ouvrir une conversation, pas en faire autre chose, et la clé Gemini ne
// quitte jamais le serveur.
//
// MÊME PRINCIPE QUE interpret-command : le modèle ne voit jamais l'inventaire
// entier ni aucun identifiant de base. Les outils déclarés ici s'exécutent
// DANS L'APP, sur l'index déjà filtré par la RLS, et ne rendent que ce qu'il
// faut pour répondre — des noms, des chemins, des références de session.
//
// Deux actions :
//   start → solde la conversation précédente restée ouverte, vérifie l'accord
//           et le plafond du jour, réserve, délivre le jeton ;
//   end   → rend la part non utilisée de la réservation.
//
// PAS DE DURÉE PAR CONVERSATION. Une conversation reçoit tout ce qui reste du
// plafond du jour : on parle tant qu'on veut, dans la limite de ce plafond.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenAI, Modality, Type, StartSensitivity, EndSensitivity } from 'npm:@google/genai@2.22.0';

const MODEL = Deno.env.get('VOICE_LIVE_MODEL') ?? 'gemini-3.1-flash-live-preview';
const VOICE = Deno.env.get('VOICE_LIVE_VOICE') ?? 'Aoede';

// RÉGLABLE SANS MISE À JOUR DE L'APP : `supabase secrets set` suffit.
const DAILY_SECONDS = positiveInt(Deno.env.get('VOICE_LIVE_DAILY_SECONDS'), 600);
// En dessous, une session ne sert à rien : on renvoie plutôt vers l'assistant
// simple, qui ne coûte presque rien.
const MIN_SECONDS = 30;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Envoyé par l'app, en texte, quand le plafond du jour arrive à son terme : le
// modèle l'annonce avec sa propre voix au lieu d'être coupé net. Même valeur
// dans src/features/assistant/live/useLiveAssistant.ts.
const TIME_UP = '[daily_time_up]';

const PROMPTS: Record<'fr' | 'en', string> = {
  fr: `Tu es Céoù, l'assistant vocal d'une application qui retient où l'on range ses affaires. L'inventaire est organisé ainsi : Logement > Pièce > Rangement (meuble) > Boîte > Objet.

Ta façon de parler :
- Tu parles français, tu tutoies, sur un ton chaleureux et naturel, comme un proche serviable.
- Reste exclusivement en français pendant toute la conversation. Ne traduis pas les paroles de l'utilisateur, les noms d'objets ou de lieux. Ignore la télévision, la musique et les voix en arrière-plan. Si la parole est indistincte, demande de répéter en français au lieu de deviner une autre langue ou d'exécuter une action.
- Tes réponses sont COURTES : une ou deux phrases. On te parle souvent les mains prises.
- Tu ne lis jamais une longue liste : au-delà de quatre éléments, tu cites les premiers et tu dis combien il y en a en tout.
- Pour dire où se trouve un objet, tu donnes le chemin du plus large au plus précis, avec des virgules : « dans le garage, sur l'établi, dans la boîte à outils ».

Règles absolues :
- Tu ne connais RIEN de l'inventaire par toi-même. Pour toute question sur un objet, une pièce ou un prêt, tu appelles un outil AVANT de répondre, et tu ne dis que ce que l'outil a renvoyé. Tu n'inventes jamais un objet, un endroit ou un nombre.
- Quand l'utilisateur dit avoir rangé ou posé quelque chose quelque part, tu appelles move_object. Si l'outil répond "ambiguous", tu poses UNE question courte en citant les options, puis tu rappelles move_object avec les références (object_ref, destination_ref) de l'option choisie.
- Si l'outil répond "not_found", tu le dis simplement et tu proposes de reformuler. Tu ne crées jamais rien.
- Si l'utilisateur dit « annule », « non, pas là » juste après un rangement, tu appelles undo_last_move.
- Un simple « merci », « d'accord » ou une pause ne termine pas la conversation : reste disponible. Appelle end_conversation seulement si l'utilisateur demande clairement de terminer ou dit au revoir, après une formule brève.
- L'utilisateur peut te couper la parole à tout moment : tu t'arrêtes et tu réponds à ce qu'il vient de dire, sans reprendre ta phrase.
- Le message ${TIME_UP} ne vient pas de l'utilisateur, mais de l'application : le temps de conversation du jour est écoulé. Tu le dis en une phrase, en précisant que l'assistant simple prend le relais, puis tu appelles end_conversation.
- Hors du rangement et de la recherche d'affaires, tu dis gentiment que tu ne sais aider que pour retrouver, ranger et suivre les prêts.`,
  en: `You are Céoù, the voice assistant of an app that remembers where people put their things. The inventory is organised as: Home > Room > Storage (furniture) > Box > Item.

How you speak:
- You speak English, warmly and naturally, like a helpful friend.
- Stay exclusively in English throughout the conversation. Do not translate the user's words, item names or place names. Ignore television, music and background voices. If speech is unclear, ask them to repeat in English instead of guessing another language or taking an action.
- Your answers are SHORT: one or two sentences. People often talk to you with their hands full.
- Never read out a long list: beyond four items, name the first ones and say how many there are in total.
- To say where an item is, give the path from the widest to the most precise, with commas: "in the garage, on the workbench, in the toolbox".

Absolute rules:
- You know NOTHING about the inventory on your own. For any question about an item, a room or a loan, call a tool BEFORE answering, and only say what the tool returned. Never invent an item, a place or a number.
- When the user says they put something somewhere, call move_object. If the tool answers "ambiguous", ask ONE short question naming the options, then call move_object again with the refs (object_ref, destination_ref) of the chosen option.
- If the tool answers "not_found", say so simply and suggest rephrasing. Never create anything.
- If the user says "undo" or "no, not there" right after a move, call undo_last_move.
- A simple "thanks", "okay" or a pause does not end the conversation: stay available. Call end_conversation only when the user clearly asks to finish or says goodbye, after a brief farewell.
- The user may interrupt you at any time: stop and answer what they just said, without resuming your sentence.
- The message ${TIME_UP} does not come from the user but from the app: today's conversation time is over. Say so in one sentence, adding that the simple assistant takes over, then call end_conversation.
- Outside finding, putting away and tracking loans, kindly say that this is all you can help with.`,
};

// Les descriptions d'outils restent en anglais pour les deux langues : c'est
// la langue dans laquelle le modèle est le plus régulier à les suivre, et
// l'utilisateur ne les entend jamais.
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'find_objects',
        description:
          "Search the user's inventory for items by name. Returns up to 8 matches, each with a ref, the item name, its full location path, and whether it is currently lent out.",
        parameters: {
          type: Type.OBJECT,
          properties: { query: { type: Type.STRING, description: 'Item name as said by the user, singular, no article.' } },
          required: ['query'],
        },
      },
      {
        name: 'list_place',
        description:
          'List what is stored in a room, a piece of furniture or a box. Returns the place that matched (with its path) and the items it contains, or candidate places when several match.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            place: { type: Type.STRING, description: 'Place name as said by the user, no article.' },
            place_ref: { type: Type.STRING, description: 'Ref of a place from a previous result, when the user picked one.' },
          },
          required: ['place'],
        },
      },
      {
        name: 'move_object',
        description:
          'Record that an item has been put away somewhere. Status: moved, already_there, ambiguous (with candidates to ask about), not_found, forbidden or failed.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            object: { type: Type.STRING, description: 'Item name as said by the user.' },
            destination: { type: Type.STRING, description: 'Where it was put, keeping the room when mentioned.' },
            object_ref: { type: Type.STRING, description: 'Ref of the item chosen among previous candidates.' },
            destination_ref: { type: Type.STRING, description: 'Ref of the destination chosen among previous candidates.' },
          },
          required: ['object', 'destination'],
        },
      },
      {
        name: 'undo_last_move',
        description: 'Put the last item moved during this conversation back where it was.',
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: 'list_loans',
        description: 'List items currently lent to someone or borrowed from someone, with the person and the due date.',
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: 'end_conversation',
        description: 'Close the conversation, after a short goodbye.',
        parameters: { type: Type.OBJECT, properties: {} },
      },
    ],
  },
];

type Pending = { sessionId: string; usedSeconds: number };

function readPending(value: unknown): Pending | null {
  const candidate = value as Partial<Pending> | null;
  if (typeof candidate?.sessionId !== 'string') return null;
  const used = Math.round(Number(candidate.usedSeconds));
  return { sessionId: candidate.sessionId, usedSeconds: Number.isFinite(used) ? used : 0 };
}

async function start(
  userId: string,
  language: 'fr' | 'en',
  pending: Pending | null,
  serviceClient: ReturnType<typeof createClient>,
  apiKey: string,
) {
  // UNE CONVERSATION QUI N'A PAS PU RENDRE COMPTE — app tuée, réseau perdu au
  // moment de raccrocher — retient toute la réservation, donc tout le reste du
  // jour. L'app garde la durée qu'elle a réellement utilisée et la rend ici,
  // AVANT de calculer ce qui reste. Le solde ne s'applique qu'une fois : un
  // renvoi est sans effet.
  if (pending) {
    const { error: settleError } = await serviceClient.rpc('voice_live_settle', {
      p_user_id: userId,
      p_session_id: pending.sessionId,
      p_used_seconds: pending.usedSeconds,
    });
    if (settleError) console.error('Pending settle failed', settleError);
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('ai_voice_live_consent_at')
    .eq('id', userId)
    .single();
  if (profileError) {
    console.error('Profile read failed', profileError);
    return jsonResponse({ error: 'profile_unavailable' }, 500);
  }
  // L'ACCORD EST VÉRIFIÉ ICI, pas seulement dans l'app : c'est ici que part
  // la voix, c'est donc ici qu'il doit faire foi.
  if (!profile?.ai_voice_live_consent_at) return jsonResponse({ error: 'consent_required' }, 403);

  // Durée demandée = le plafond entier : la réservation accorde donc tout ce
  // qui reste du jour.
  const { data: reserved, error: reserveError } = await serviceClient.rpc('voice_live_reserve', {
    p_user_id: userId,
    p_session_seconds: DAILY_SECONDS,
    p_daily_seconds: DAILY_SECONDS,
    p_min_seconds: MIN_SECONDS,
  });
  if (reserveError) {
    console.error('Reservation failed', reserveError);
    return jsonResponse({ error: 'reservation_failed' }, 500);
  }
  const grant = (reserved as { session_id: string; granted_seconds: number; remaining_seconds: number }[] | null)?.[0];
  if (!grant) return jsonResponse({ error: 'quota_exhausted' }, 429);

  const now = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // La session peut durer ce qui a été accordé ; une marge couvre la
        // lenteur d'une ouverture sur réseau mobile.
        expireTime: new Date(now + (grant.granted_seconds + 60) * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        // Sans `lockAdditionalFields`, TOUS les champs ci-dessous sont
        // verrouillés : le client ne peut ni changer les consignes, ni
        // retirer un outil, ni choisir un autre modèle.
        liveConnectConstraints: {
          model: MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
            systemInstruction: PROMPTS[language],
            tools: TOOLS,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                prefixPaddingMs: 300,
                silenceDurationMs: 700,
              },
            },
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return jsonResponse({
      token: token.name,
      model: MODEL,
      sessionId: grant.session_id,
      maxSeconds: grant.granted_seconds,
      remainingSeconds: grant.remaining_seconds,
    });
  } catch (error) {
    console.error('Ephemeral token creation failed', error);
    // Rien n'a été ouvert : la réservation est rendue entièrement.
    await serviceClient.rpc('voice_live_settle', { p_user_id: userId, p_session_id: grant.session_id, p_used_seconds: 0 });
    return jsonResponse({ error: 'ai_unavailable' }, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !serviceRoleKey) {
    console.error('Missing GEMINI_API_KEY or SUPABASE_SERVICE_ROLE_KEY');
    return jsonResponse({ error: 'misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !supabaseUrl || !anonKey) return jsonResponse({ error: 'unauthorized' }, 401);
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'unauthorized' }, 401);

  // UN INVITÉ N'OUVRE PAS DE CONVERSATION : un compte anonyme se recrée en un
  // appui, le plafond par compte ne le retiendrait pas. Il garde l'assistant
  // simple.
  if (userData.user.is_anonymous) return jsonResponse({ error: 'account_required' }, 403);

  let body: { action?: string; language?: string; sessionId?: string; usedSeconds?: number; pending?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  if (body.action === 'start') {
    return start(userData.user.id, body.language === 'en' ? 'en' : 'fr', readPending(body.pending), serviceClient, apiKey);
  }

  if (body.action === 'end') {
    if (typeof body.sessionId !== 'string') return jsonResponse({ error: 'invalid_body' }, 400);
    const used = Math.round(Number(body.usedSeconds));
    const { error } = await serviceClient.rpc('voice_live_settle', {
      p_user_id: userData.user.id,
      p_session_id: body.sessionId,
      p_used_seconds: Number.isFinite(used) ? used : 0,
    });
    if (error) {
      console.error('Settle failed', error);
      return jsonResponse({ error: 'settle_failed' }, 500);
    }
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'invalid_action' }, 400);
});
