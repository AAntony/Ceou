import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { STACK_SCALE, useTextScale } from '../../lib/textScale';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import type { LocationType } from '../../types/database';
import { AiPhotoScanFlow } from './AiPhotoScanFlow';
import { ObjetFormBody } from './ObjetFormBody';

type CreateObjetModalProps = {
  visible: boolean;
  onClose: () => void;
  parentType: LocationType;
  parentId: string;
};

type Mode = 'manual' | 'scan';

export function CreateObjetModal({ visible, onClose, parentType, parentId }: CreateObjetModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('manual');

  useEffect(() => {
    if (visible) setMode('manual');
  }, [visible]);

  // Vrai quand le texte est assez gros pour que le formulaire dépasse
  // l'écran : la feuille prend alors un cadre de hauteur définie.
  const { textScale } = useTextScale();
  const framed = textScale >= STACK_SCALE;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-surface pt-6"
      // Mode scan : hauteur DÉFINIE, parce qu'AiPhotoScanFlow s'appuie dessus
      // (états centrés en `flex-1`, barre d'actions en `absolute bottom-0`)
      // — il lui faut un cadre stable à remplir.
      //
      // Mode manuel : normalement AUCUN style de hauteur, la feuille se
      // mesure sur le formulaire (voir le commentaire de la branche manuelle
      // plus bas). MAIS en gros texte ce formulaire dépasse l'écran, et une
      // feuille sans borne sort alors par le HAUT — titre invisible. On
      // bascule donc sur la recette du mode scan, celle dont on a la preuve
      // sur appareil : hauteur définie + `flex: 1` sur la branche, et le
      // ScrollView d'ObjetFormBody a enfin un cadre à remplir.
      //
      // Conditionnel et non systématique : à taille normale, une feuille de
      // 88 % pour trois champs serait un mur.
      sheetStyle={mode === 'scan' || framed ? { height: '88%' } : undefined}
    >
      <View className="mb-4 px-6">
        <Text className="mb-4 text-heading font-bold text-ink">{t('inventory.container.create_objet_title')}</Text>
        {/* Bascule manuel/scan explicite (mêmes pastilles que les onglets
            Personnelles/Partagées, Phase 9c) — une simple icône dans le coin
            s'est révélée trop discrète, la saisie manuelle semblait absente
            (retour utilisateur du 2026-08-18). Indépendante des boutons
            Annuler/Enregistrer de chaque formulaire, qui referment toujours
            toute la feuille. */}
        <SegmentedTabs
          value={mode}
          onChange={setMode}
          options={[
            { value: 'manual' as const, label: t('inventory.container.tab_manual') },
            { value: 'scan' as const, label: t('inventory.container.tab_scan') },
          ]}
        />
      </View>
      {/* AUCUNE propriété flex ici, volontairement — `display` et rien
          d'autre. La feuille n'a pas de hauteur définie en mode manuel :
          elle se mesure sur son contenu. Or `flex: 1` (flexBasis 0) comme
          `flexShrink: 1` ont tous les deux été essayés ici et laissaient le
          formulaire à hauteur nulle sur téléphone — invisible, sans erreur
          ni warning, et non reproductible dans le navigateur (react-native-web
          retombe sur le dimensionnement max-content du CSS).
          Sans propriété flex, ce bloc prend la hauteur de son contenu. Ne
          pas y remettre de flex sans l'avoir vérifié sur un vrai téléphone.
          La raison probable de l'échec ici, comprise depuis : le ScrollView
          qui doit défiler appartient à ObjetFormBody, il n'est donc pas
          l'enfant direct de la feuille — un plafond posé sur ce View-ci ne
          borne pas ce qui défile. CreateEntityModal, lui, donne son
          ScrollView directement à la feuille et supporte le plafond. */}
      <View style={{ flex: framed ? 1 : undefined, display: mode === 'manual' ? 'flex' : 'none' }}>
        <ObjetFormBody parentType={parentType} parentId={parentId} active={visible} onDone={onClose} onCancel={onClose} />
      </View>
      <View style={{ flex: 1, display: mode === 'scan' ? 'flex' : 'none' }}>
        <AiPhotoScanFlow parentType={parentType} parentId={parentId} active={visible && mode === 'scan'} onDone={onClose} onCancel={onClose} />
      </View>
    </BottomSheetModal>
  );
}
