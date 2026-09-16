import type { Conteneur, Emplacement, Piece, Habitation } from '../../types/database';

export type ObjetLocationNode = {
  kind: 'habitation' | 'piece' | 'emplacement' | 'conteneur';
  id: string;
  name: string;
  preset_key: string | null;
  // Vrai uniquement pour la pièce fantôme d'une habitation mono-espace
  // (Garage, Cave...), que le fil d'ariane écarte de l'affichage — la fiche
  // objet, elle, garde ce maillon pour le lien vers le plan.
  is_default: boolean;
};

export type EntityLookups = {
  conteneur: (id: string) => Conteneur | undefined;
  emplacement: (id: string) => Emplacement | undefined;
  piece: (id: string) => Piece | undefined;
  habitation: (id: string) => Habitation | undefined;
};

/**
 * Les entités sont fournies par des FONCTIONS et non par des tables, pour que
 * cette logique serve aux deux appelants sans être écrite deux fois : le
 * préchargement, qui a tout en mémoire, et le déplacement d'un objet, qui doit
 * recalculer le chemin depuis le cache.
 */
export function locationChainFrom(
  start: { emplacementId: string | null; conteneurId: string | null },
  lookups: EntityLookups,
): ObjetLocationNode[] {
  const nested: Conteneur[] = [];
  const seen = new Set<string>();
  let emplacementId = start.emplacementId;
  let cursor = start.conteneurId;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const conteneur = lookups.conteneur(cursor);
    if (!conteneur) break;
    nested.push(conteneur);
    if (conteneur.parent_emplacement_id) emplacementId = conteneur.parent_emplacement_id;
    cursor = conteneur.parent_conteneur_id;
  }
  // Remonté depuis l'objet, donc du plus interne au plus englobant.
  nested.reverse();

  const emplacement = emplacementId ? lookups.emplacement(emplacementId) : undefined;
  const piece = emplacement ? lookups.piece(emplacement.piece_id) : undefined;
  const habitation = piece ? lookups.habitation(piece.habitation_id) : undefined;

  const chain: ObjetLocationNode[] = [];
  if (habitation) {
    chain.push({ kind: 'habitation', id: habitation.id, name: habitation.name, preset_key: null, is_default: false });
  }
  if (piece) {
    chain.push({ kind: 'piece', id: piece.id, name: piece.name, preset_key: piece.preset_key, is_default: piece.is_default });
  }
  if (emplacement) {
    chain.push({
      kind: 'emplacement',
      id: emplacement.id,
      name: emplacement.name,
      preset_key: emplacement.preset_key,
      is_default: false,
    });
  }
  for (const conteneur of nested) {
    chain.push({ kind: 'conteneur', id: conteneur.id, name: conteneur.name, preset_key: null, is_default: false });
  }
  return chain;
}

