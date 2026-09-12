import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpaceForAppTabBar } from '../../components/AppTabBar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Icon } from '../../components/Icon';
import { usePullToRefresh } from '../../components/usePullToRefresh';
import { showMessage } from '../../lib/dialog';
import { logClientError } from '../../lib/errorLogging';
import { ONE_COLUMN_SCALE, useTextScale } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { AssistantConsentSheet } from '../assistant/AssistantConsentSheet';
import { AssistantSheet } from '../assistant/AssistantSheet';
import { useAssistant } from '../assistant/useAssistant';
import { GuestBanner } from '../auth/GuestBanner';
import { useIsAnonymous } from '../auth/SessionProvider';
import { AddObjetModal } from '../inventory/AddObjetModal';
import { OnboardingGuide } from '../onboarding/OnboardingGuide';
import { useOnboardingLaunch } from '../onboarding/useOnboarding';
import { useProfile, useSetAiConsent } from '../profile/useProfile';
import { ResultCard } from './ResultCard';
import { useSearchIndex, type SearchIndexEntry } from './queries';
import { rankResults } from './rank';

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      className={`mr-2 min-h-[48px] justify-center rounded-full border px-4 py-2 active:opacity-70 ${selected ? 'border-coral bg-coral-light' : 'border-ink/15 bg-surface'}`}>
      <Text className={`text-label ${selected ? 'font-semibold text-coral-dark' : 'text-ink-soft'}`}>{selected ? '✓ ' : ''}{label}</Text>
    </Pressable>
  );
}

export function HomeDashboard() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const bottomSpace = useSpaceForAppTabBar();
  const refreshControl = usePullToRefresh();
  const { textScale } = useTextScale();
  const { data: profile } = useProfile();
  const { data: entries, isLoading, isError, refetch } = useSearchIndex();
  const isGuest = useIsAnonymous();
  const [search, setSearch] = useState('');
  const [homeId, setHomeId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [grid, setGrid] = useState(false);
  const [adding, setAdding] = useState(false);
  const [consent, setConsent] = useState(false);
  const assistant = useAssistant();
  const onboarding = useOnboardingLaunch();
  const setConsentMutation = useSetAiConsent('ai_assistant_consent_at');
  const columns = grid && textScale < ONE_COLUMN_SCALE ? 2 : 1;
  const homes = useMemo(() => Array.from(new Map((entries ?? []).map((entry) => [entry.habitation_id, entry.habitation_name])).entries()), [entries]);
  const activeHome = homes.some(([id]) => id === homeId) ? homeId : null;
  const rooms = useMemo(() => Array.from(new Map((entries ?? [])
    .filter((entry) => !activeHome || entry.habitation_id === activeHome)
    .map((entry) => [entry.piece_id, { name: entry.piece_name, home: entry.habitation_name }])).entries())
    .sort((a, b) => a[1].name.localeCompare(b[1].name)), [entries, activeHome]);
  const activeRoom = rooms.some(([id]) => id === roomId) ? roomId : null;
  const filtered = useMemo(() => rankResults(entries ?? [], search, activeHome, activeRoom), [entries, search, activeHome, activeRoom]);
  const renderItem = useCallback(({ item }: { item: SearchIndexEntry }) => <ResultCard entry={item} columns={columns} />, [columns]);
  const reset = () => { setSearch(''); setHomeId(null); setRoomId(null); };
  const startAssistant = () => {
    if (assistant.active) { assistant.stop(); return; }
    if (profile?.ai_assistant_consent_at) assistant.start();
    else setConsent(true);
  };
  const acceptConsent = async () => {
    try {
      await setConsentMutation.mutateAsync();
      setConsent(false);
      assistant.start();
    } catch (error) {
      logClientError(error, { source: 'assistant', step: 'consent' });
      showMessage(t('common.error_generic'));
    }
  };
  return (
    <View className="flex-1 bg-sand" style={{ paddingTop: insets.top + 12 }}>
      <View className="px-6 pb-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Text accessibilityRole="header" className="text-title font-bold text-ink">{t('redesign.find')}</Text>
          <Text className="text-label font-semibold text-coral-dark">Céoù</Text>
        </View>
        <View className="min-h-[52px] flex-row items-center rounded-2xl border border-ink/20 bg-surface pl-4">
          <Icon name="search" size={22} color={colors.inkSoft} />
          <TextInput value={search} onChangeText={setSearch} accessibilityLabel={t('redesign.search')}
            placeholder={t('redesign.search')} placeholderTextColor={colors.inkSoft}
            autoCapitalize="none" autoCorrect={false} returnKeyType="search"
            className="min-w-0 flex-1 px-3 py-3 text-body text-ink" />
          {search ? <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={t('common.clear')}
            className="min-h-[48px] min-w-[48px] items-center justify-center"><Icon name="close" size={20} color={colors.inkSoft} /></Pressable> : null}
        </View>
      </View>
      <FlatList key={columns} data={isError ? [] : filtered} renderItem={renderItem} numColumns={columns}
        keyExtractor={(entry) => `${entry.kind}-${entry.id}`} refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={12} windowSize={5}
        columnWrapperStyle={columns === 2 ? { gap: 12 } : undefined}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomSpace + 24 }}
        ListHeaderComponent={
          <View>
            {isGuest ? <GuestBanner /> : <View className="mb-4"><Text className="text-heading font-semibold text-ink">{t('redesign.headline')}</Text><Text className="mt-1 text-label text-ink-soft">{t('redesign.tagline')}</Text></View>}
            <View className={`${textScale >= 1.3 ? 'gap-2' : 'flex-row gap-2'} mb-5`}>
              {!isGuest ? <View className="flex-1"><Button label={t('redesign.add')} onPress={() => setAdding(true)} /></View> : null}
              <View className={isGuest ? 'flex-1' : undefined}><Button label={t('redesign.speak')} variant="outline" onPress={startAssistant} /></View>
            </View>
            <Text className="mb-2 text-caption text-ink-soft">{t(isGuest ? 'redesign.guestScope' : 'redesign.scope')}</Text>
            {homes.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <FilterChip label={t('redesign.allHomes')} selected={!activeHome} onPress={() => { setHomeId(null); setRoomId(null); }} />
              {homes.map(([id, name]) => <FilterChip key={id} label={name} selected={activeHome === id} onPress={() => { setHomeId(id); setRoomId(null); }} />)}
            </ScrollView> : null}
            {rooms.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <FilterChip label={t('redesign.allRooms')} selected={!activeRoom} onPress={() => setRoomId(null)} />
              {rooms.map(([id, room]) => <FilterChip key={id} label={!activeHome && homes.length > 1 ? `${room.name} · ${room.home}` : room.name}
                selected={activeRoom === id} onPress={() => setRoomId(activeRoom === id ? null : id)} />)}
            </ScrollView> : null}
            <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
              <Text accessibilityLiveRegion="polite" className="text-label font-semibold text-ink">{isLoading ? t('redesign.loading') : t('redesign.results', { count: filtered.length })}</Text>
              {textScale < ONE_COLUMN_SCALE ? <Pressable accessibilityRole="button" accessibilityState={{ selected: grid }} onPress={() => setGrid(!grid)} className="min-h-[48px] justify-center rounded-xl bg-surface px-4">
                <Text className="text-label font-semibold text-coral-dark">{t(grid ? 'redesign.list' : 'redesign.grid')}</Text>
              </Pressable> : null}
            </View>
          </View>
        }
        ListEmptyComponent={isError ? <ErrorState onRetry={() => refetch()} /> : isLoading ? <ActivityIndicator accessibilityLabel={t('redesign.loading')} color={colors.accentDark} /> : (
          <EmptyState icon="search" title={t(search || activeRoom || activeHome ? 'redesign.noResults' : 'redesign.emptyTitle')}
            action={<View className="gap-4"><Text className="text-center text-body text-ink-soft">{t(search || activeRoom || activeHome ? 'redesign.noResultsHint' : 'redesign.emptyHint')}</Text>
              {search || activeRoom || activeHome ? <Button label={t('redesign.reset')} onPress={reset} variant="outline" /> : onboarding.canOffer ? <Button label={t('onboarding.entry_title')} onPress={onboarding.start} /> : !isGuest ? <Button label={t('redesign.add')} onPress={() => setAdding(true)} /> : null}</View>} />
        )} />
      <AddObjetModal visible={adding} onClose={() => setAdding(false)} />
      <OnboardingGuide visible={onboarding.open} onClose={onboarding.close} />
      <AssistantConsentSheet visible={consent} loading={setConsentMutation.isPending} onAccept={acceptConsent} onCancel={() => setConsent(false)} />
      <AssistantSheet state={assistant} onClose={assistant.stop} onChooseObjet={assistant.chooseObjet}
        onChooseDestination={assistant.chooseDestination} onSkipChoice={assistant.skipChoice} onUndoMove={assistant.undoMove} />
    </View>
  );
}
