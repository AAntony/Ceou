import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { EntityCard } from '../../components/EntityCard';
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase/client';
import type { Conteneur, Emplacement, Habitation, LocationType, Piece } from '../../types/database';
import { getEmplacementIcon, getHabitationIcon, isSingleSpaceHabitation } from './constants';
import { useContainerContents, useEmplacements, useHabitations, useMoveObjet, usePieces } from './queries';

type Step =
  | { level: 'habitations' }
  | { level: 'pieces'; habitationId: string }
  | { level: 'emplacements'; pieceId: string }
  | { level: 'container'; type: LocationType; id: string; name: string };

type MoveObjetModalProps = {
  visible: boolean;
  onClose: () => void;
  objetId: string;
};

export function MoveObjetModal({ visible, onClose, objetId }: MoveObjetModalProps) {
  const { t } = useTranslation();
  const moveObjet = useMoveObjet(objetId);
  const [stack, setStack] = useState<Step[]>([{ level: 'habitations' }]);

  useEffect(() => {
    if (visible) setStack([{ level: 'habitations' }]);
  }, [visible]);

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

  const handleChoose = async (type: LocationType, id: string) => {
    await moveObjet.mutateAsync({ type, id });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-sand pt-16">
        <View className="mb-2 flex-row items-center justify-between px-6">
          {stack.length > 1 ? (
            <Pressable onPress={pop} hitSlop={8}>
              <Icon name="back" size={22} color="#2D2A26" />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <Text className="text-lg font-bold text-ink">{t('inventory.objet.move_title')}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={22} color="#2D2A26" />
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="px-6 pb-10 pt-2">
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
              loading={moveObjet.isPending}
              onSelectConteneur={(conteneur) => push({ level: 'container', type: 'conteneur', id: conteneur.id, name: conteneur.name })}
              onChooseHere={() => handleChoose(current.type, current.id)}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
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
  loading,
  onSelectConteneur,
  onChooseHere,
}: {
  type: LocationType;
  id: string;
  loading: boolean;
  onSelectConteneur: (conteneur: Conteneur) => void;
  onChooseHere: () => void;
}) {
  const { t } = useTranslation();
  const { conteneurs } = useContainerContents(type, id);
  return (
    <>
      <View className="mb-4">
        <Button label={t('inventory.objet.move_choose_here')} onPress={onChooseHere} loading={loading} />
      </View>
      {conteneurs.map((conteneur) => (
        <EntityCard key={conteneur.id} icon="conteneur" title={conteneur.name} onPress={() => onSelectConteneur(conteneur)} />
      ))}
    </>
  );
}
