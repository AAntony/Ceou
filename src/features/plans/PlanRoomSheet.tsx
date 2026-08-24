import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { getEmplacementIcon, getPieceIcon } from '../inventory/constants';
import { useEmplacements } from '../inventory/queries';
import type { Piece } from '../../types/database';
import { useThemeColors } from '../../lib/theme';

// Fiche d'une pièce, ouverte au tap depuis le mode Explorer.
//
// C'est elle qui rend le mode Explorer utile plutôt que décoratif : le plan
// montre OÙ, cette fiche dit CE QU'IL Y A, et donne l'accès direct au
// rangement voulu. Sans elle, toucher une pièce ne faisait que la surligner.
//
// Les emplacements ne portent pas leur propre compteur d'objets : ce serait
// une requête serveur de plus pour une information secondaire. Le total de la
// pièce, lui, est déjà calculé pour l'affichage sur le plan et repris ici.

export function PlanRoomSheet({
  piece,
  objectCount,
  onClose,
}: {
  piece: Piece | null;
  objectCount: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: emplacements } = useEmplacements(piece?.id ?? '');

  const list = emplacements ?? [];

  return (
    <BottomSheetModal
      visible={piece !== null}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-surface px-5 pb-4 pt-5"
      sheetStyle={{ maxHeight: '80%' }}
    >
      {piece ? (
        <>
          <View className="mb-5 flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-coral-light">
              <Icon name={getPieceIcon(piece.preset_key)} size={22} color="#1591EA" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-ink" numberOfLines={1}>
                {piece.name}
              </Text>
              <Text className="text-sm text-ink-soft">
                {objectCount === null
                  ? t('plans.room_sheet.storages', { n: list.length })
                  : `${t('plans.room_sheet.objects', { n: objectCount })} · ${t('plans.room_sheet.storages', { n: list.length })}`}
              </Text>
            </View>
          </View>

          {list.length > 0 ? (
            <>
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {t('plans.room_sheet.storages_title')}
              </Text>
              {/* maxHeight + flexShrink : la recette documentée dans
                  BottomSheetModal pour une liste qui doit défiler sous un
                  plafond. Une pièce très rangée peut avoir beaucoup
                  d'emplacements. */}
              <ScrollView style={{ maxHeight: 260, flexShrink: 1 }}>
                {list.map((emplacement) => (
                  <Pressable
                    accessibilityRole="button"
                    key={emplacement.id}
                    onPress={() => {
                      onClose();
                      router.push(`/emplacement/${emplacement.id}`);
                    }}
                    className="flex-row items-center gap-3 border-b border-ink/5 py-3 active:opacity-70"
                  >
                    <Icon name={getEmplacementIcon(emplacement.preset_key)} size={20} color={colors.inkSoft} />
                    <Text className="flex-1 text-base text-ink" numberOfLines={1}>
                      {emplacement.name}
                    </Text>
                    <Icon name="chevron" size={18} color={colors.inkFaint} />
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <Text className="mb-2 text-sm leading-5 text-ink-soft">{t('plans.room_sheet.empty')}</Text>
          )}

          <View className="mt-4">
            <Button
              label={t('plans.room_sheet.open')}
              onPress={() => {
                onClose();
                router.push(`/piece/${piece.id}`);
              }}
            />
          </View>
        </>
      ) : null}
    </BottomSheetModal>
  );
}
