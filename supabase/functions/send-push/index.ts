// Envoi d'une notification push à l'AUTRE partie d'une relation d'amitié.
//
// POURQUOI UNE FONCTION APPELEE PAR LE CLIENT, ET PAS UN TRIGGER POSTGRES :
// un trigger sur `friendships` attraperait tous les chemins d'écriture d'un
// coup (send_friend_request, redeem_share_invite, respond_to_friendship),
// c'est vrai. Mais pour sortir de la base il lui faudrait pg_net ET la clé
// service_role stockée côté base — donc une clé secrète posée dans un
// fichier de migration versionné, ou une configuration manuelle hors dépôt.
// Les trois évènements notifiables sont tous déclenchés par une action de
// l'utilisateur dans l'app : le client est déjà là, authentifié, au bon
// moment. On garde la clé du côté qui en a déjà besoin.
//
// GARDE-FOU CONTRE LE SPAM : l'appelant ne choisit PAS le destinataire. Il
// fournit l'identifiant d'une relation d'amitié, et la fonction en déduit
// qui notifier — après avoir vérifié que l'appelant est bien la partie qui a
// le droit de déclencher cet évènement, dans le bon état. Impossible donc
// d'arroser un inconnu : il faut une relation existante avec lui.
//
// Le texte est composé ICI, dans la langue du DESTINATAIRE (profiles.locale)
// et non celle de l'expéditeur : au moment où la notification arrive, l'app
// du destinataire n'est pas forcément lancée, elle ne peut pas traduire quoi
// que ce soit.

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Simple garde anti-martèlement, pas une vraie limite d'usage : les envois
// légitimes sont espacés de plusieurs secondes au minimum (le temps de taper
// un code ami, d'accepter une demande). Compteur `push`, distinct de ceux du
// scan photo et de l'assistant vocal — voir la migration ai_rate_limit_kinds.
const RATE_LIMIT_COOLDOWN_SECONDS = 2;
const RATE_LIMIT_KIND = 'push';

// Le service Expo accepte 100 messages par requête. Personne n'a 100
// appareils ; la borne protège seulement d'un envoi absurde.
const MAX_TOKENS_PER_SEND = 100;

type PushEvent = 'friend_request' | 'friend_accepted';

type Copy = { title: string; body: string };

// Le prénom est injecté tel quel : c'est le display_name que la personne a
// choisi, pas une donnée sensible, et il est déjà visible dans l'app.
const COPY: Record<PushEvent, Record<'fr' | 'en', (name: string) => Copy>> = {
  friend_request: {
    fr: (name) => ({ title: "Nouvelle demande d'ami", body: `${name} souhaite t'ajouter sur Céoù.` }),
    en: (name) => ({ title: 'New friend request', body: `${name} wants to connect on Céoù.` }),
  },
  friend_accepted: {
    fr: (name) => ({ title: 'Demande acceptée', body: `${name} a accepté ta demande d'ami.` }),
    en: (name) => ({ title: 'Request accepted', body: `${name} accepted your friend request.` }),
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function isPushEvent(value: unknown): value is PushEvent {
  return value === 'friend_request' || value === 'friend_accepted';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authHeader || !supabaseUrl || !anonKey) return jsonResponse({ error: 'unauthorized' }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'unauthorized' }, 401);
  const callerId = userData.user.id;

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) return jsonResponse({ error: 'missing_service_role_key' }, 500);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: allowed, error: rateLimitError } = await serviceClient.rpc('check_and_touch_ai_rate_limit', {
    p_user_id: callerId,
    p_kind: RATE_LIMIT_KIND,
    p_cooldown_seconds: RATE_LIMIT_COOLDOWN_SECONDS,
  });
  if (rateLimitError) {
    console.error('Rate limit check failed', rateLimitError);
    return jsonResponse({ error: 'rate_limit_check_failed' }, 500);
  }
  if (!allowed) return jsonResponse({ error: 'rate_limited' }, 429);

  let body: { event?: unknown; friendshipId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const event = body.event;
  const friendshipId = body.friendshipId;
  if (!isPushEvent(event) || typeof friendshipId !== 'string' || !friendshipId) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const { data: friendship, error: friendshipError } = await serviceClient
    .from('friendships')
    .select('requester_id, addressee_id, status')
    .eq('id', friendshipId)
    .maybeSingle();
  if (friendshipError) {
    console.error('Friendship lookup failed', friendshipError);
    return jsonResponse({ error: 'lookup_failed' }, 500);
  }
  if (!friendship) return jsonResponse({ error: 'friendship_not_found' }, 404);

  // Le coeur du garde-fou : qui a le droit de déclencher quoi, et dans quel
  // état de la relation. Toute autre combinaison est refusée.
  let recipientId: string;
  if (event === 'friend_request') {
    if (friendship.requester_id !== callerId || friendship.status !== 'pending') {
      return jsonResponse({ error: 'forbidden' }, 403);
    }
    recipientId = friendship.addressee_id;
  } else {
    if (friendship.addressee_id !== callerId || friendship.status !== 'accepted') {
      return jsonResponse({ error: 'forbidden' }, 403);
    }
    recipientId = friendship.requester_id;
  }

  const [{ data: sender }, { data: recipient }, { data: tokenRows, error: tokensError }] = await Promise.all([
    serviceClient.from('profiles').select('display_name, friend_code').eq('id', callerId).maybeSingle(),
    serviceClient.from('profiles').select('locale').eq('id', recipientId).maybeSingle(),
    serviceClient.from('push_tokens').select('token').eq('user_id', recipientId).limit(MAX_TOKENS_PER_SEND),
  ]);

  if (tokensError) {
    console.error('Token lookup failed', tokensError);
    return jsonResponse({ error: 'lookup_failed' }, 500);
  }

  const tokens = (tokenRows ?? []).map((row: { token: string }) => row.token);
  // Aucun appareil enregistré n'est un cas NORMAL (notifications refusées,
  // app jamais ouverte depuis la mise à jour) — surtout pas une erreur.
  if (tokens.length === 0) return jsonResponse({ sent: 0 });

  // Le code ami en repli : un compte sans nom choisi n'a rien d'autre
  // d'identifiant à afficher, et « Quelqu'un » ne dirait rien à personne.
  const senderName = sender?.display_name?.trim() || sender?.friend_code || '?';
  const locale = recipient?.locale === 'en' ? 'en' : 'fr';
  const copy = COPY[event][locale](senderName);

  const messages = tokens.map((token) => ({
    to: token,
    title: copy.title,
    body: copy.body,
    sound: 'default',
    // Doit correspondre au canal créé côté app (push.ts) : sans canal
    // déclaré, Android range la notification dans un canal par défaut sur
    // lequel l'app n'a aucune main.
    channelId: 'default',
    priority: 'high',
    // Route ouverte au tap. Une donnée, pas une instruction : c'est l'app
    // qui décide quoi en faire (voir PushRegistrar).
    data: { url: '/friends' },
  }));

  const expoResponse = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!expoResponse.ok) {
    console.error('Expo push failed', expoResponse.status, await expoResponse.text());
    return jsonResponse({ error: 'push_unavailable' }, 502);
  }

  const payload = await expoResponse.json();
  const tickets: { status?: string; details?: { error?: string } }[] = Array.isArray(payload?.data) ? payload.data : [];

  // Un jeton devient invalide dès que l'app est désinstallée ou que les
  // notifications sont coupées. Sans ce ménage, on rappellerait le service
  // Expo indéfiniment pour un appareil qui n'existe plus.
  const stale = tickets
    .map((ticket, index) => (ticket?.details?.error === 'DeviceNotRegistered' ? tokens[index] : null))
    .filter((token): token is string => token !== null);
  if (stale.length > 0) {
    const { error: cleanupError } = await serviceClient.from('push_tokens').delete().in('token', stale);
    if (cleanupError) console.error('Stale token cleanup failed', cleanupError);
  }

  const sent = tickets.filter((ticket) => ticket?.status === 'ok').length;
  return jsonResponse({ sent });
});
