/**
 * Extrait le code d'erreur brut d'un échec de RPC Postgres
 * (`raise exception 'xxx'`), pour le traduire en message lisible.
 *
 * ⚠️ `instanceof Error` ne suffit PAS ici : confirmé en test réel que l'objet
 * d'erreur renvoyé par supabase-js pour un RPC en échec n'est PAS reconnu
 * comme une instance d'Error au runtime (raison exacte non élucidée —
 * possiblement une frontière de bundle/realm), alors que `.message` existe
 * bel et bien dessus. Résultat observé avant ce correctif : TOUTE erreur RPC
 * (code introuvable, déjà en contact, auto-ajout...) retombait sur le message
 * générique au lieu du message spécifique. D'où le test par duck-typing
 * (présence d'un `.message` string) plutôt que par prototype.
 *
 * Factorisé ici parce que deux écrans en dépendent désormais (ajout d'ami et
 * entrée d'un visiteur par code) : c'est exactement le genre de contournement
 * subtil qu'on ne veut pas voir se dégrader en étant recopié.
 */
export function rpcErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === 'string') return message;
  }
  return '';
}
