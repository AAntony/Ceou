export type SearchableLocation = {
  kind: string; id: string; name: string;
  habitation_id: string; habitation_name: string;
  piece_id: string; piece_name: string; parent_label: string | null;
};
const STOP_WORDS = new Set(['un', 'une', 'le', 'la', 'les', 'des', 'du', 'de', 'the', 'a', 'an', 'in', 'dans']);
const normalise = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

/** Pure ranking; exact names precede multi-word and partial matches. */
export function rankResults<T extends SearchableLocation>(entries: readonly T[], query: string, homeId: string | null, roomId: string | null): T[] {
  const needle = normalise(query);
  const words = needle.split(/\s+/).filter((word) => word && !STOP_WORDS.has(word));
  const terms = words.length ? words : needle ? [needle] : [];
  return entries.filter((entry) => (!homeId || entry.habitation_id === homeId) && (!roomId || entry.piece_id === roomId))
    .map((entry) => {
      const name = normalise(entry.name);
      const location = normalise([entry.parent_label, entry.piece_name, entry.habitation_name].filter(Boolean).join(' '));
      let score = 0;
      if (!needle) score = entry.kind === 'objet' ? 1 : 0;
      else if (name === needle) score = 100;
      else if (terms.every((term) => name.includes(term))) score = 80;
      else if (terms.every((term) => `${name} ${location}`.includes(term))) score = 60;
      else if (terms.some((term) => name.includes(term))) score = 20;
      return { entry, score };
    }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, undefined, { sensitivity: 'base', numeric: true }) || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry }) => entry);
}