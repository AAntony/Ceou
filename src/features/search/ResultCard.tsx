import { router } from 'expo-router';
import { EntityCard } from '../../components/EntityCard';
import { getEmplacementIcon, getPieceIcon } from '../inventory/constants';
import { HUE_BADGE_FILL, HUE_CARD_BG_HEX, hueForKind } from './palette';
import type { SearchIndexEntry, SearchKind } from './queries';

const ROUTE_BY_KIND: Record<SearchKind, string> = {
  objet: 'objet',
  conteneur: 'conteneur',
  emplacement: 'emplacement',
  piece: 'piece',
};

function locationLine(entry: SearchIndexEntry): string {
  if (entry.kind === 'piece') return entry.habitation_name;
  if (entry.kind === 'emplacement') return entry.piece_name;
  return `${entry.parent_label} · ${entry.piece_name}`;
}

function iconForEntry(entry: SearchIndexEntry) {
  if (entry.kind === 'emplacement') return getEmplacementIcon(entry.preset_key);
  if (entry.kind === 'piece') return getPieceIcon(entry.preset_key);
  return entry.kind;
}

type ResultCardProps = {
  entry: SearchIndexEntry;
};

// Même carte-grille que EntityCard (icône/photo + titre + sous-titre,
// tuile 48%) — déléguée à EntityCard plutôt que dupliquée, ResultCard ne
// porte plus que la logique propre aux résultats de recherche (icône/route/
// libellé de localisation selon le type d'entrée).
export function ResultCard({ entry }: ResultCardProps) {
  const hue = hueForKind(entry.kind);

  return (
    <EntityCard
      icon={iconForEntry(entry)}
      imageUri={entry.photo_url}
      title={entry.name}
      subtitle={locationLine(entry)}
      bgColor={HUE_CARD_BG_HEX[hue]}
      badgeColor={HUE_BADGE_FILL[hue]}
      onPress={() => router.push(`/${ROUTE_BY_KIND[entry.kind]}/${entry.id}`)}
    />
  );
}
