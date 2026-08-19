import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
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

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-white pt-6"
      // Les deux modes n'ont PAS le même besoin de hauteur, d'où deux
      // réglages distincts plutôt qu'un seul :
      // - scan : hauteur DÉFINIE (88%), parce qu'AiPhotoScanFlow s'appuie
      //   dessus (états centrés en `flex-1`, barre d'actions en `absolute
      //   bottom-0`) — il lui faut un cadre stable à remplir.
      // - manuel : simple PLAFOND, la feuille se dimensionne sur le
      //   formulaire (court) et ne défile qu'une fois le plafond atteint.
      sheetStyle={mode === 'scan' ? { height: '88%' } : { maxHeight: '88%' }}
    >
      <View className="mb-4 px-6">
        <Text className="mb-4 text-xl font-bold text-ink">{t('inventory.container.create_objet_title')}</Text>
        {/* Bascule manuel/scan explicite (mêmes pastilles que les onglets
            Personnelles/Partagées, Phase 9c) — une simple icône dans le coin
            s'est révélée trop discrète, la saisie manuelle semblait absente
            (retour utilisateur du 2026-08-18). Indépendante des boutons
            Annuler/Enregistrer de chaque formulaire, qui referment toujours
            toute la feuille. */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setMode('manual')}
            className={`flex-1 items-center rounded-xl border px-4 py-3 ${mode === 'manual' ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
          >
            <Text className={mode === 'manual' ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
              {t('inventory.container.tab_manual')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('scan')}
            className={`flex-1 items-center rounded-xl border px-4 py-3 ${mode === 'scan' ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
          >
            <Text className={mode === 'scan' ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
              {t('inventory.container.tab_scan')}
            </Text>
          </Pressable>
        </View>
      </View>
      {/* `flexShrink: 1` et SURTOUT PAS `flex: 1` — même piège que dans
          FriendDetailSheet/ShareInviteModal, ici sous une forme plus
          trompeuse encore. `flex: 1` met `flexBasis` à 0 : ce bloc ne
          compte alors pour RIEN dans la hauteur d'une feuille qui n'a qu'un
          `maxHeight`, la feuille se réduit au titre + aux deux pastilles,
          et le formulaire est rendu avec une hauteur nulle. Symptôme vu par
          l'utilisateur : appuyer sur "Saisie manuelle" ne fait "rien",
          aucun champ n'apparaît. Ne se reproduit PAS sur navigateur, où
          react-native-web retombe sur le dimensionnement max-content du
          CSS. `flexShrink: 1` garde `flexBasis: auto` : mesuré sur son
          contenu, il ne se comprime qu'au plafond de la feuille. */}
      <View style={{ flexShrink: 1, display: mode === 'manual' ? 'flex' : 'none' }}>
        <ObjetFormBody parentType={parentType} parentId={parentId} active={visible} onDone={onClose} onCancel={onClose} />
      </View>
      <View style={{ flex: 1, display: mode === 'scan' ? 'flex' : 'none' }}>
        <AiPhotoScanFlow parentType={parentType} parentId={parentId} active={visible && mode === 'scan'} onDone={onClose} onCancel={onClose} />
      </View>
    </BottomSheetModal>
  );
}
