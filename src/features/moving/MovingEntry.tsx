import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import { ProjectForm } from './forms';
import { useMovingProjects } from './queries';

/** A secondary destination below places, visually separate from the tab selector. */
export function MovingEntry() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const projects = useMovingProjects();
  const [creating, setCreating] = useState(false);
  const active = (projects.data ?? []).filter(project => project.status !== 'completed');
  const open = () => {
    if (!projects.isSuccess) { router.push('/moving'); return; }
    if (active.length === 1) { router.push(`/moving/${active[0].id}`); return; }
    if (active.length > 1) { router.push('/moving'); return; }
    setCreating(true);
  };

  return (
    <View className="mt-5 border-t border-ink/10 pt-3">
      <Pressable accessibilityRole="button" onPress={open}
        className="min-h-[64px] flex-row items-center gap-3 rounded-xl py-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
        <Icon name="conteneur" size={24} color={colors.inkSoft} />
        <View className="flex-1">
          <Text className="text-body font-semibold text-ink">{t(active.length ? 'moving.resumeEntry' : 'moving.entry')}</Text>
          <Text className="mt-1 text-label text-ink-soft">{active.length === 1 ? active[0].name : t('moving.entryHint')}</Text>
        </View>
        <Icon name="chevron" size={20} color={colors.inkSoft} />
      </Pressable>
      {(projects.data ?? []).some(project => project.status === 'completed') ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/moving', params: { archive: '1' } })}
          className="min-h-[48px] justify-center rounded-xl py-2">
          <Text className="text-label text-ink-soft">{t('moving.seeArchives')}</Text>
        </Pressable>
      ) : null}
      {creating ? <ProjectForm onClose={() => setCreating(false)} onCreated={id => {
        setCreating(false); router.push(`/moving/${id}`);
      }} /> : null}
    </View>
  );
}
