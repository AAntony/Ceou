import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { EntityCard } from '../../components/EntityCard';
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase/client';
import type { Conteneur, Emplacement, Habitation, LocationType, Piece } from '../../types/database';
import { getEmplacementIcon, getHabitationIcon, isSingleSpaceHabitation } from './constants';
import { useContainerContents, useEmplacements, useHabitations, usePieces } from './queries';

type Step =
  | { level: 'habitations' }
  | { level: 'pieces'; habitationId: string }
  | { level: 'emplacements'; pieceId: string }
  | { level: 'container'; type: LocationType; id: string; name: string };

type LocationTreePickerProps = {
  // Remonte la pile à la racine à chaque fois que cette valeur passe à true
  // (typiquement `visible` de la modale parente) — le picker peut rester
  // monté d'un usage à l'autre.
  active: boolean;
  confirmLabel: string;
  loading?: boolean;
  onChoose: (type: LocationType, id: string) => void;
};

// Navigation en cascade Habitations -> Pièces -> Emplacements -> Conteneurs,
// réutilisée à la fois pour déplacer un objet (MoveObjetModal) et pour
// choisir la destination d'un nouvel objet (AddObjetModal) — même
// arborescence, seule l'action finale change.
export function LocationTreePicker({ active, confirmLabel, loading, onChoose }: LocationTreePickerProps) {
  const { t } = useTranslation();
  const [stack, setStack] = useState<Step[]>([{ level: 'habitations' }]);

  useEffect(() => {
    if (active) setStack([{ level: 'habitations' }]);
  }, [active]);

  const current = stack[stack.length - 1];
  const push = (step: Step) => setStack((s) => [...s, step]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const handleSelectHabitation = async (habitation: Habitation) => {
    if (isSingleSpaceHabitation(habitation.type)) {
      const { data } = await supabase.from('pieces').select('id').eq('habitation_id', habitation.id).single();
      if (data) push({ level: 'emplacements', pieceId: data.id });
    } else {
      push({ level: 'pieces', habitationId: habitation.id });
    }
  };

  return (
    <View>
      {stack.length > 1 ? (
        <Pressable onPress={pop} hitSlop={8} className="mb-3 flex-row items-center gap-1 self-start">
          <Icon name="back" size={16} color="#6B6459" />
          <Text className="text-sm font-medium text-ink-soft">{t('common.back')}</Text>
        </Pressable>
      ) : null}

      {current.level === 'habitations' && <HabitationsStep onSelect={handleSelectHabitation} />}
      {current.level === 'pieces' && (
        <PiecesStep habitationId={current.habitationId} onSelect={(piece) => push({ level: 'emplacements', pieceId: piece.id })} />
      )}
      {current.level === 'emplacements' && (
        <EmplacementsStep
          pieceId={current.pieceId}
          onSelect={(emplacement) => push({ level: 'container', type: 'emplacement', id: emplacement.id, name: emplacement.name })}
        />
      )}
      {current.level === 'container' && (
        <ContainerStep
          type={current.type}
          id={current.id}
          confirmLabel={confirmLabel}
          loading={loading}
          onSelectConteneur={(conteneur) => push({ level: 'container', type: 'conteneur', id: conteneur.id, name: conteneur.name })}
          onChooseHere={() => onChoose(current.type, current.id)}
        />
      )}
    </View>
  );
}

function HabitationsStep({ onSelect }: { onSelect: (habitation: Habitation) => void }) {
  const { data: habitations } = useHabitations();
  return (
    <>
      {habitations?.map((habitation) => (
        <EntityCard key={habitation.id} icon={getHabitationIcon(habitation.type)} title={habitation.name} onPress={() => onSelect(habitation)} />
      ))}
    </>
  );
}

function PiecesStep({ habitationId, onSelect }: { habitationId: string; onSelect: (piece: Piece) => void }) {
  const { data: pieces } = usePieces(habitationId);
  return (
    <>
      {pieces?.map((piece) => (
        <EntityCard key={piece.id} icon="piece" title={piece.name} onPress={() => onSelect(piece)} />
      ))}
    </>
  );
}

function EmplacementsStep({ pieceId, onSelect }: { pieceId: string; onSelect: (emplacement: Emplacement) => void }) {
  const { data: emplacements } = useEmplacements(pieceId);
  return (
    <>
      {emplacements?.map((emplacement) => (
        <EntityCard
          key={emplacement.id}
          icon={getEmplacementIcon(emplacement.preset_key)}
          title={emplacement.name}
          onPress={() => onSelect(emplacement)}
        />
      ))}
    </>
  );
}

function ContainerStep({
  type,
  id,
  confirmLabel,
  loading,
  onSelectConteneur,
  onChooseHere,
}: {
  type: LocationType;
  id: string;
  confirmLabel: string;
  loading?: boolean;
  onSelectConteneur: (conteneur: Conteneur) => void;
  onChooseHere: () => void;
}) {
  const { conteneurs } = useContainerContents(type, id);
  return (
    <>
      <View className="mb-4">
        <Button label={confirmLabel} onPress={onChooseHere} loading={loading} />
      </View>
      {conteneurs.map((conteneur) => (
        <EntityCard key={conteneur.id} icon="conteneur" title={conteneur.name} onPress={() => onSelectConteneur(conteneur)} />
      ))}
    </>
  );
}
