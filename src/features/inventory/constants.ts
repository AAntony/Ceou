import type { IconName } from '../../components/Icon';

export type HabitationTypeKey = 'maison' | 'appartement' | 'garage' | 'cave' | 'cellier' | 'box' | 'vehicule' | 'autre';

export type HabitationTypeDefinition = {
  key: HabitationTypeKey;
  icon: IconName;
  /** Pas de couche Pièce visible dans l'UI : une Pièce unique est créée et gérée en silence. */
  singleSpace: boolean;
};

export const HABITATION_TYPES: HabitationTypeDefinition[] = [
  { key: 'maison', icon: 'maison', singleSpace: false },
  { key: 'appartement', icon: 'appartement', singleSpace: false },
  { key: 'garage', icon: 'garage', singleSpace: true },
  { key: 'cave', icon: 'cave', singleSpace: true },
  { key: 'cellier', icon: 'cellier', singleSpace: true },
  { key: 'box', icon: 'box', singleSpace: true },
  { key: 'vehicule', icon: 'vehicule', singleSpace: true },
  { key: 'autre', icon: 'autre', singleSpace: true },
];

export function isSingleSpaceHabitation(type: string): boolean {
  return HABITATION_TYPES.find((t) => t.key === type)?.singleSpace ?? true;
}

export function getHabitationIcon(type: string): IconName {
  return HABITATION_TYPES.find((t) => t.key === type)?.icon ?? 'autre';
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
  icon: IconName;
};

export const EMPLACEMENT_PRESETS: EmplacementPresetDefinition[] = [
  { key: 'armoire', icon: 'armoire' },
  { key: 'dressing', icon: 'dressing' },
  { key: 'commode', icon: 'commode' },
  { key: 'etagere', icon: 'etagere' },
  { key: 'placard', icon: 'placard' },
  { key: 'bureau', icon: 'bureau' },
  { key: 'table_de_chevet', icon: 'table_de_chevet' },
  { key: 'tiroir', icon: 'tiroir' },
  { key: 'coffre', icon: 'coffre' },
  { key: 'boite_a_gants', icon: 'boite_a_gants' },
  { key: 'autre', icon: 'autre' },
];

export const DEFAULT_ICON: IconName = 'autre';

export function getEmplacementIcon(presetKey: string | null): IconName {
  return EMPLACEMENT_PRESETS.find((p) => p.key === presetKey)?.icon ?? DEFAULT_ICON;
}

export type PieceTypeKey =
  | 'chambre'
  | 'sejour'
  | 'cuisine'
  | 'salle_de_bain'
  | 'bureau'
  | 'dressing'
  | 'buanderie'
  | 'cave'
  | 'garage'
  | 'entree'
  | 'autre';

export type PieceTypeDefinition = {
  key: PieceTypeKey;
  icon: IconName;
};

// Suggestions communes à la plupart des habitations — pas de contrainte
// stricte, "Autre" + le champ Nom restent toujours modifiables librement.
export const PIECE_TYPES: PieceTypeDefinition[] = [
  { key: 'chambre', icon: 'chambre' },
  { key: 'sejour', icon: 'sejour' },
  { key: 'cuisine', icon: 'cuisine' },
  { key: 'salle_de_bain', icon: 'salle_de_bain' },
  { key: 'bureau', icon: 'bureau' },
  { key: 'dressing', icon: 'dressing' },
  { key: 'buanderie', icon: 'buanderie' },
  { key: 'cave', icon: 'cave' },
  { key: 'garage', icon: 'garage' },
  { key: 'entree', icon: 'entree' },
  { key: 'autre', icon: 'autre' },
];

export function getPieceIcon(presetKey: string | null): IconName {
  return PIECE_TYPES.find((p) => p.key === presetKey)?.icon ?? DEFAULT_ICON;
}
