export type HabitationTypeKey = 'maison' | 'appartement' | 'garage' | 'cave' | 'cellier' | 'box' | 'vehicule' | 'autre';

export type HabitationTypeDefinition = {
  key: HabitationTypeKey;
  icon: string;
  /** Pas de couche Pièce visible dans l'UI : une Pièce unique est créée et gérée en silence. */
  singleSpace: boolean;
};

export const HABITATION_TYPES: HabitationTypeDefinition[] = [
  { key: 'maison', icon: '🏠', singleSpace: false },
  { key: 'appartement', icon: '🏢', singleSpace: false },
  { key: 'garage', icon: '🚗', singleSpace: true },
  { key: 'cave', icon: '🕳️', singleSpace: true },
  { key: 'cellier', icon: '🧺', singleSpace: true },
  { key: 'box', icon: '📦', singleSpace: true },
  { key: 'vehicule', icon: '🚐', singleSpace: true },
  { key: 'autre', icon: '❔', singleSpace: true },
];

export function isSingleSpaceHabitation(type: string): boolean {
  return HABITATION_TYPES.find((t) => t.key === type)?.singleSpace ?? true;
}

export type EmplacementPresetKey =
  | 'armoire'
  | 'dressing'
  | 'commode'
  | 'etagere'
  | 'placard'
  | 'bureau'
  | 'table_de_chevet'
  | 'tiroir'
  | 'coffre'
  | 'boite_a_gants'
  | 'autre';

export type EmplacementPresetDefinition = {
  key: EmplacementPresetKey;
  icon: string;
};

export const EMPLACEMENT_PRESETS: EmplacementPresetDefinition[] = [
  { key: 'armoire', icon: '🚪' },
  { key: 'dressing', icon: '👕' },
  { key: 'commode', icon: '🗄️' },
  { key: 'etagere', icon: '📚' },
  { key: 'placard', icon: '🚪' },
  { key: 'bureau', icon: '🖥️' },
  { key: 'table_de_chevet', icon: '🛏️' },
  { key: 'tiroir', icon: '🗃️' },
  { key: 'coffre', icon: '🧰' },
  { key: 'boite_a_gants', icon: '🚙' },
  { key: 'autre', icon: '❔' },
];

export const DEFAULT_ICON = '❔';

export function getEmplacementIcon(presetKey: string | null): string {
  return EMPLACEMENT_PRESETS.find((p) => p.key === presetKey)?.icon ?? DEFAULT_ICON;
}
