import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Icon, type IconName } from '../../components/Icon';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';

type AddPlaceSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAddPlace: () => void;
  onMove: () => void;
};

// CE QUE PROPOSE « + AJOUTER » SUR LES LIEUX.
//
// Le déménagement vit ici plutôt que sous la liste : il ne dépend plus du
// défilement, et il ne prend aucune place tant qu'on ne s'en sert pas. Une fois
// lancé, c'est la barre au-dessus des onglets qui le rend accessible.
export function AddPlaceSheet({ visible, onClose, onAddPlace, onMove }: AddPlaceSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <BottomSheetModal visible={visible} onClose={onClose} scrollable sheetClassName="rounded-t-3xl bg-surface px-6 pb-6 pt-5">
      <View className="mb-4 flex-row items-center justify-between gap-2">
        <Text accessibilityRole="header" className="flex-1 text-heading font-bold text-ink">
          {t('inventory.habitations.add_choice_title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          className="min-h-[48px] min-w-[48px] items-center justify-center"
        >
          <Icon name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View className="gap-3">
        <Option
          icon="maison"
          title={t('inventory.habitations.add_place')}
          subtitle={t('inventory.habitations.add_place_hint')}
          onPress={onAddPlace}
        />
        <Option icon="conteneur" title={t('moving.start')} subtitle={t('moving.startSubtitle')} onPress={onMove} />
      </View>
    </BottomSheetModal>
  );
}

function Option({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  const colors = useThemeColors();
  // La vignette grandit avec le texte, comme celles des lignes de la liste.
  const tile = useScaled(44);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-sand px-4 py-3 active:opacity-70"
    >
      <View style={{ width: tile, height: tile }} className="items-center justify-center rounded-xl bg-coral-light">
        <Icon name={icon} size={22} color={colors.accentDark} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-body font-semibold text-ink">{title}</Text>
        <Text className="mt-0.5 text-label text-ink-soft">{subtitle}</Text>
      </View>
      <Icon name="chevron" size={18} color={colors.inkSoft} />
    </Pressable>
  );
}
