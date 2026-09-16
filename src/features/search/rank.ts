export type SearchableLocation = {
  kind: string; id: string; name: string;
  habitation_id: string; habitation_name: string;
  piece_id: string; piece_name: string; parent_label: string | null;
};
const STOP_WORDS = new Set(['un', 'une', 'le', 'la', 'les', 'des', 'du', 'de', 'the', 'a', 'an', 'in', 'dans']);
const normalise = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

export type PreparedSearchEntry<T> = { entry: T; name: string; text: string };

/** Rebuild on inventory changes, rather than normalising and sorting on every keystroke. */
export function prepareSearchIndex<T extends SearchableLocation>(entries: readonly T[]): PreparedSearchEntry<T>[] {
  const names = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  return entries.map((entry) => {
    const name = normalise(entry.name);
    const location = normalise([entry.parent_label, entry.piece_name, entry.habitation_name].filter(Boolean).join(' '));
    return { entry, name, text: `${name} ${location}` };
  }).sort((a, b) => names.compare(a.entry.name, b.entry.name) || a.entry.id.localeCompare(b.entry.id));
}

/** Fixed score buckets preserve ranking and alphabetical ties in one linear scan. */
export function searchPreparedIndex<T extends SearchableLocation>(
  index: readonly PreparedSearchEntry<T>[], query: string, homeId: string | null, roomId: string | null,
): T[] {
  const needle = normalise(query);
  const words = needle.split(/\s+/).filter((word) => word && !STOP_WORDS.has(word));
  const terms = words.length ? words : needle ? [needle] : [];
  const exact: T[] = [], names: T[] = [], locations: T[] = [], partial: T[] = [];
  for (const { entry, name, text } of index) {
    if ((homeId && entry.habitation_id !== homeId) || (roomId && entry.piece_id !== roomId)) continue;
    if (!needle) {
      if (entry.kind === 'objet') exact.push(entry);
    } else if (name === needle) exact.push(entry);
    else if (terms.every((term) => name.includes(term))) names.push(entry);
    else if (terms.every((term) => text.includes(term))) locations.push(entry);
    else if (terms.some((term) => name.includes(term))) partial.push(entry);
  }
  return exact.concat(names, locations, partial);
}

/** One-off searches; interactive callers retain the prepared index. */
export function rankResults<T extends SearchableLocation>(entries: readonly T[], query: string, homeId: string | null, roomId: string | null): T[] {
  return searchPreparedIndex(prepareSearchIndex(entries), query, homeId, roomId);
}
