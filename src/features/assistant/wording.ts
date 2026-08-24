import i18n from '../../lib/i18n';

// POURQUOI L'ASSISTANT SONNAIT MÉCANIQUE.
//
// Moins à cause de la voix que des mots. Une réponse formulée exactement de la
// même façon à chaque fois s'entend comme une machine, quelle que soit la
// qualité de la synthèse — et en session on entend la même confirmation dix
// fois de suite.
//
// Le remède ne touche pas à la garantie qui compte : c'est toujours l'app qui
// rédige à partir de ses propres données, jamais le modèle. On lui donne
// seulement plusieurs façons de dire la même chose.
//
// Une variante s'ajoute en écrivant `<clé>_alt1`, `_alt2`… à côté de la clé
// de base dans les fichiers de traduction. Rien à déclarer ici : la clé de
// base compte pour une formulation, les `_altN` s'ajoutent, et une clé sans
// aucune variante se comporte exactement comme avant.

/** Nombre de variantes trouvées, par langue et par clé. */
const alternateCounts = new Map<string, number>();
/** Dernière formulation servie, pour ne jamais la resservir deux fois d'affilée. */
const lastPicked = new Map<string, number>();

function countAlternates(key: string): number {
  let found = 0;
  while (i18n.exists(`${key}_alt${found + 1}`)) found += 1;
  return found;
}

/**
 * La même phrase, dite autrement d'une fois sur l'autre.
 *
 * Signature identique à `t` : elle se substitue directement là où l'app
 * compose ses réponses, sans que le code appelant ait à savoir si une clé a
 * des variantes ou non.
 */
export function pickVariant(key: string, options?: Record<string, unknown>): string {
  // Le décompte dépend de la langue chargée : une clé peut avoir trois
  // formulations en français et une seule en anglais.
  const cacheKey = `${i18n.language}:${key}`;
  let alternates = alternateCounts.get(cacheKey);
  if (alternates === undefined) {
    alternates = countAlternates(key);
    alternateCounts.set(cacheKey, alternates);
  }

  if (alternates === 0) return i18n.t(key, options ?? {});

  // 0 désigne la clé de base, 1..n les variantes.
  const total = alternates + 1;
  let index = Math.floor(Math.random() * total);
  if (index === lastPicked.get(cacheKey)) index = (index + 1) % total;
  lastPicked.set(cacheKey, index);

  return index === 0 ? i18n.t(key, options ?? {}) : i18n.t(`${key}_alt${index}`, options ?? {});
}
