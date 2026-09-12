import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import type { EntityLevel } from '../features/inventory/placeholders';
import { useMediaSource } from '../lib/images/media';
import { useTextScale } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';
import { Icon, type IconName } from './Icon';

type EntityRowProps = {
  level: EntityLevel; thumbnail?: ReactNode; icon: IconName; title: string; subtitle?: string;
  photoUri?: string | null; iconColor?: string; onPress: () => void; onEdit?: () => void;
  isFavorite?: boolean; onToggleFavorite?: () => void; favoriteDisabled?: boolean;
  onMoveUp?: () => void; onMoveDown?: () => void;
};

/** Navigation and management have separate touch targets, with no nested buttons. */
export function EntityRow({ thumbnail, icon, title, subtitle, photoUri, iconColor, onPress, onEdit,
  isFavorite, onToggleFavorite, favoriteDisabled, onMoveUp, onMoveDown }: EntityRowProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const photo = useMediaSource(photoUri);
  const { textScale } = useTextScale();
  const stacked = textScale >= 1.3 || !!onMoveUp || !!onMoveDown;
  const actions = !!(onEdit || onToggleFavorite || onMoveUp || onMoveDown);
  return (
    <View className="mb-3 overflow-hidden rounded-2xl bg-surface">
      <View className={stacked ? '' : 'flex-row items-center'}>
        <Pressable accessibilityRole="button" accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
          onPress={onPress} className={`flex-row items-center gap-3 p-4 active:opacity-70 ${stacked ? '' : 'flex-1'}`}>
          {textScale < 2 ? <View style={{ width: 56, height: 60 }} className="items-center justify-center overflow-hidden rounded-xl bg-coral-light">
            {thumbnail ?? (photo ? <Image source={photo} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon name={icon} size={28} color={iconColor ?? colors.accentDark} />)}
          </View> : null}
          <View className="min-w-0 flex-1">
            <Text className="text-body font-semibold text-ink">{title}</Text>
            {subtitle ? <Text className="mt-1 text-label text-ink-soft">{subtitle}</Text> : null}
          </View>
          {!actions ? <Icon name="chevron" size={18} color={colors.inkSoft} /> : null}
        </Pressable>
        {actions ? <View className={`flex-row flex-wrap items-center ${stacked ? 'border-t border-ink/10 px-3 pb-2' : 'pr-2'}`}>
          {onToggleFavorite ? <Pressable onPress={onToggleFavorite} disabled={favoriteDisabled}
            accessibilityRole="button" accessibilityState={{ selected: isFavorite, disabled: favoriteDisabled }}
            accessibilityLabel={t(isFavorite ? 'a11y.favorite_remove' : 'a11y.favorite_add', { name: title })}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl active:opacity-60">
            <Icon name={isFavorite ? 'star' : 'starOutline'} size={22} color={isFavorite ? colors.mustardDark : colors.inkSoft} />
          </Pressable> : null}
          {onEdit ? <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={t('a11y.edit_named', { name: title })}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl active:opacity-60"><Icon name="pencil" size={20} color={colors.inkSoft} /></Pressable> : null}
          {onMoveUp || onMoveDown ? <View className="flex-row">
            <Pressable onPress={onMoveUp} disabled={!onMoveUp} accessibilityRole="button" accessibilityState={{ disabled: !onMoveUp }} accessibilityLabel={t('a11y.move_up_named', { name: title })}
              className={`min-h-[48px] min-w-[48px] items-center justify-center ${!onMoveUp ? 'opacity-40' : ''}`}><Icon name="moveUp" size={22} /></Pressable>
            <Pressable onPress={onMoveDown} disabled={!onMoveDown} accessibilityRole="button" accessibilityState={{ disabled: !onMoveDown }} accessibilityLabel={t('a11y.move_down_named', { name: title })}
              className={`min-h-[48px] min-w-[48px] items-center justify-center ${!onMoveDown ? 'opacity-40' : ''}`}><Icon name="moveDown" size={22} /></Pressable>
          </View> : null}
        </View> : null}
      </View>
    </View>
  );
}
