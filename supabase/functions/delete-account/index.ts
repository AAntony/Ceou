// Suppression définitive du compte de l'appelant.
//
// Exigence de publication, pas un confort : Apple (règle 5.1.1(v)) et Google
// Play imposent tous deux que toute app créant des comptes offre la
// suppression DEPUIS l'app. Une adresse e-mail de contact ne suffit pas.
//
// Pourquoi une Edge Function et pas une RPC Postgres : effacer une ligne de
// auth.users demande la clé service_role, qui ne doit JAMAIS se retrouver
// dans un bundle d'application (décompilable). Même raison d'être que
// detect-objects pour GEMINI_API_KEY.
//
// verify_jwt reste ACTIF (valeur par défaut) : seul un utilisateur connecté
// atteint cette fonction, et l'identité supprimée est celle du jeton — il
// n'y a volontairement aucun paramètre d'entrée, donc aucun moyen de
// demander la suppression du compte de quelqu'un d'autre.

import { createClient } from 'npm:@supabase/supabase-js@2';

// Les fichiers Storage ne suivent PAS la cascade de auth.users (le Storage
// est un service à part, ses lignes ne sont pas liées par clé étrangère à
// nos tables). Sans ce nettoyage explicite, supprimer un compte laisserait
// ses photos accessibles indéfiniment sur des buckets publics — exactement
// le contraire de ce que la suppression promet à l'utilisateur.
const BUCKETS = ['avatars', 'objets'] as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// `.list()` ne descend pas dans les sous-dossiers et ne renvoie que 100
// entrées par défaut : on pagine et on récursive, sinon un compte très
// fourni verrait une partie de ses photos survivre en silence.
async function listAllPaths(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const PAGE = 100;
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const full = `${prefix}/${entry.name}`;
      // Un « dossier » remonte sans id ni metadata — c'est le seul
      // discriminant que l'API Storage expose.
      if (entry.id === null) paths.push(...(await listAllPaths(admin, bucket, full)));
      else paths.push(full);
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return paths;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'server_misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // L'identité vient du jeton, jamais du corps de la requête.
  const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (userError || !userData.user) return jsonResponse({ error: 'invalid_token' }, 401);

  const userId = userData.user.id;

  // Storage d'abord, base ensuite. Dans cet ordre, un échec à mi-parcours
  // laisse un compte encore utilisable (l'utilisateur peut relancer) plutôt
  // qu'un compte détruit dont les photos resteraient orphelines et
  // définitivement inatteignables — plus personne n'aurait alors le uid
  // permettant de les retrouver.
  for (const bucket of BUCKETS) {
    try {
      const paths = await listAllPaths(admin, bucket, userId);
      if (paths.length > 0) {
        const { error: removeError } = await admin.storage.from(bucket).remove(paths);
        if (removeError) throw removeError;
      }
    } catch (storageError) {
      return jsonResponse(
        { error: 'storage_cleanup_failed', bucket, detail: String(storageError) },
        500,
      );
    }
  }

  // Emporte en cascade profiles, habitations (et tout l'inventaire en
  // dessous), amitiés, partages, favoris et invitations émises.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return jsonResponse({ error: 'delete_failed', detail: deleteError.message }, 500);

  return jsonResponse({ deleted: true });
});
