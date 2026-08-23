import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { ErrorState } from '../../../src/components/ErrorState';
import { HeaderAddButton } from '../../../src/components/HeaderAddButton';
import { SegmentedTabs } from '../../../src/components/SegmentedTabs';
import { isSingleSpaceHabitation } from '../../../src/features/inventory/constants';
import { PieceEmplacements } from '../../../src/features/inventory/PieceEmplacements';
import { PieceList } from '../../../src/features/inventory/PieceList';
import { useHabitation, usePieces } from '../../../src/features/inventory/queries';
import { PlansList } from '../../../src/features/plans/PlansList';
import { canModify, useHabitationPermission } from '../../../src/features/sharing/queries';

type Tab = 'contenu' | 'plans';

// Le Plan n'est pas une destination séparée : c'est LA MÊME habitation vue
// autrement — ses pièces dessinées dans l'espace au lieu d'être listées. D'où
// deux onglets ici plutôt qu'une route `/plans/<habitationId>` à part, qui
// n'avait qu'un seul point d'entrée dans toute l'app (un petit bouton texte
// dans le coin de l'en-tête, facile à ne jamais voir) et ajoutait un niveau
// de navigation avant l'éditeur.
//
// Le "+" de l'en-tête suit l'onglet actif — c'est ce qui le rend non
// ambigu : l'onglet dit toujours de quoi on parle. Il remplace les barres
// "Ajouter une pièce" / "Ajouter un plan" en bas de page, qui s'empilaient
// par-dessus la barre de navigation.
export default function HabitationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: habitation, isLoading, isError, refetch } = useHabitation(id);
  const singleSpace = habitation ? isSingleSpaceHabitation(habitation.type) : false;
  const { data: pieces } = usePieces(id);
  const { data: permission } = useHabitationPermission(id);
  const [tab, setTab] = useState<Tab>('contenu');
  const [addSignal, setAddSignal] = useState(0);

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading || !habitation) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  // Une habitation mono-espace (Garage, Cave, Box...) n'expose pas ses Pièces
  // — sa pièce unique est masquée — donc son premier onglet liste directement
  // des Emplacements. Seul le libellé change, la mécanique est identique.
  const contentLabel = singleSpace ? t('inventory.habitations.tab_emplacements') : t('inventory.habitations.tab_pieces');
  const addLabel =
    tab === 'plans'
      ? t('plans.add')
      : singleSpace
        ? t('inventory.emplacements.add')
        : t('inventory.pieces.add');

  return (
    <>
      <Stack.Screen
        options={{
          title: habitation.name,
          // Sans ce garde-fou, une Habitation consultee en lecture seule
          // (invite, ou ami en Consultation) affichait un "+" qui ouvrait un
          // formulaire dont l'enregistrement etait de toute facon refuse par
          // la RLS. Le droit se lit ici, pas le statut d'invite : c'est le
          // meme defaut pour les deux.
          headerRight: () =>
            canModify(permission) ? (
              <HeaderAddButton onPress={() => setAddSignal((n) => n + 1)} label={addLabel} />
            ) : null,
        }}
      />
      <View className="flex-1 bg-sand">
        <View className="px-6 pt-4">
          <SegmentedTabs
            options={[
              { value: 'contenu', label: contentLabel },
              { value: 'plans', label: t('inventory.habitations.tab_plans') },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === 'plans' ? (
          <PlansList habitationId={id} addSignal={addSignal} />
        ) : singleSpace ? (
          pieces?.[0] ? (
            <PieceEmplacements pieceId={pieces[0].id} addSignal={addSignal} />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator />
            </View>
          )
        ) : (
          <PieceList habitationId={id} addSignal={addSignal} />
        )}
      </View>
    </>
  );
}
