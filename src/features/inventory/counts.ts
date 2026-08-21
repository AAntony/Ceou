// Libellé « N objets » d'une rangée de liste.
//
// `counts` non chargé (undefined) => aucun libellé, plutôt qu'un « Aucun
// objet » affiché le temps de la requête puis remplacé par le vrai nombre :
// annoncer un endroit vide alors qu'il est plein, même une demi-seconde, est
// pire que de ne rien annoncer.
//
// Le zéro est traité à part et NON par la pluralisation : le français range
// 0 avec le singulier (Intl.PluralRules.select(0) === 'one'), donc un simple
// t(..., { count: 0 }) afficherait « 1 objet ».

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function objetCountLabel(
  t: Translate,
  counts: Map<string, number> | undefined,
  key: string,
): string | undefined {
  if (!counts) return undefined;
  const count = counts.get(key) ?? 0;
  return count === 0 ? t('inventory.objet_count_zero') : t('inventory.objet_count', { count });
}
