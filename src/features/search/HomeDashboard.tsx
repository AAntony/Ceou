import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpaceForAppTabBar } from '../../components/AppTabBar';
import { BottomSheetModal } from '../../components/BottomSheetModal';
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
      className={`mb-2 min-h-[48px] justify-center rounded-full border px-4 py-2 active:opacity-70 ${selected ? 'border-coral bg-coral-light' : 'border-ink/15 bg-surface'}`}>
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [voiceHeight, setVoiceHeight] = useState(56);
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
    <View className="flex-1 bg-sand" style={{ paddingTop: insets.top + 4 }}>
      <View className="px-4 pb-1">
        <View className="mb-1 flex-row items-center justify-between gap-3">
          <Text accessibilityRole="header" className="text-title font-bold text-coral-dark">Céoù</Text>
          {!isGuest ? <Pressable accessibilityRole="button" accessibilityLabel={t('redesign.add')}
            onPress={() => setAdding(true)} className="min-h-[48px] flex-row items-center gap-1 rounded-xl px-3 active:opacity-70">
            <Icon name="add" size={22} color={colors.accentDark} />
            <Text className="text-label font-semibold text-coral-dark">{t('redesign.addShort')}</Text>
          </Pressable> : null}
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomSpace + voiceHeight + 32 }}
        ListHeaderComponent={
          <View>
            {isGuest ? <GuestBanner /> : null}
            <View className="mb-1 flex-row flex-wrap items-center gap-2">
              <Pressable accessibilityRole="button" accessibilityLabel={t('redesign.filters')}
                accessibilityValue={{ text: [homes.find(([id]) => id === activeHome)?.[1], rooms.find(([id]) => id === activeRoom)?.[1].name].filter(Boolean).join(', ') || t('redesign.allHomes') }}
                accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(true)}
                className="min-h-[48px] flex-row items-center gap-2 rounded-xl px-3 active:opacity-70">
                <Icon name="filter" size={20} color={colors.accentDark} />
                <Text className="text-label font-semibold text-coral-dark">{t('redesign.filters')}{activeHome || activeRoom ? ' · ' + (Number(!!activeHome) + Number(!!activeRoom)) : ''}</Text>
              </Pressable>
              <Text accessibilityLiveRegion="polite" className="min-w-0 flex-1 text-caption text-ink-soft">{isLoading ? t('redesign.loading') : t('redesign.results', { count: filtered.length })}</Text>
              {textScale < ONE_COLUMN_SCALE ? <Pressable accessibilityRole="button"
                accessibilityLabel={t(grid ? 'redesign.showList' : 'redesign.showGrid')}
                onPress={() => setGrid(!grid)} className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl active:opacity-70">
                <Icon name={grid ? 'list' : 'grid'} size={22} color={colors.accentDark} />
              </Pressable> : null}
            </View>
          </View>
        }
        ListEmptyComponent={isError ? <ErrorState onRetry={() => refetch()} /> : isLoading ? <ActivityIndicator accessibilityLabel={t('redesign.loading')} color={colors.accentDark} /> : (
          <EmptyState icon="search" title={t(search || activeRoom || activeHome ? 'redesign.noResults' : 'redesign.emptyTitle')}
            action={<View className="gap-4"><Text className="text-center text-body text-ink-soft">{t(search || activeRoom || activeHome ? 'redesign.noResultsHint' : 'redesign.emptyHint')}</Text>
              {search || activeRoom || activeHome ? <Button label={t('redesign.reset')} onPress={reset} variant="outline" /> : onboarding.canOffer ? <Button label={t('onboarding.entry_title')} onPress={onboarding.start} /> : !isGuest ? <Button label={t('redesign.add')} onPress={() => setAdding(true)} /> : null}</View>} />
        )} />
      <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, left: 16, bottom: bottomSpace + 12, alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('redesign.voice')}
          accessibilityHint={t('home.assistant_a11y')} accessibilityState={{ selected: assistant.active }}
          onPress={startAssistant} onLayout={(event) => setVoiceHeight(event.nativeEvent.layout.height)}
          className="min-h-[56px] max-w-full flex-row items-center gap-2 rounded-full bg-coral px-5 py-3 active:opacity-90"
          style={{ elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
          <Icon name="microphone" size={24} color="#FFFFFF" />
          <Text className="shrink text-body font-semibold text-white">{t(assistant.active ? 'assistant.session.title' : 'redesign.voice')}</Text>
        </Pressable>
      </View>
      <BottomSheetModal visible={filtersOpen} onClose={() => setFiltersOpen(false)} scrollable sheetClassName="rounded-t-3xl bg-surface px-5 py-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text accessibilityRole="header" className="text-heading font-bold text-ink">{t('redesign.filters')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setFiltersOpen(false)} className="min-h-[48px] min-w-[48px] items-center justify-center">
            <Icon name="close" size={22} color={colors.inkSoft} />
          </Pressable>
        </View>
        <Text className="mb-3 text-label text-ink-soft">{t(isGuest ? 'redesign.guestScope' : 'redesign.scope')}</Text>
        <Text accessibilityRole="header" className="mb-2 text-body font-semibold text-ink">{t('redesign.places')}</Text>
        <FilterChip label={t('redesign.allHomes')} selected={!activeHome} onPress={() => { setHomeId(null); setRoomId(null); }} />
        {homes.map(([id, name]) => <FilterChip key={id} label={name} selected={activeHome === id} onPress={() => { setHomeId(id); setRoomId(null); }} />)}
        <Text accessibilityRole="header" className="mb-2 mt-3 text-body font-semibold text-ink">{t('redesign.rooms')}</Text>
        <FilterChip label={t('redesign.allRooms')} selected={!activeRoom} onPress={() => setRoomId(null)} />
        {rooms.map(([id, room]) => <FilterChip key={id} label={!activeHome && homes.length > 1 ? room.name + ' · ' + room.home : room.name}
          selected={activeRoom === id} onPress={() => setRoomId(activeRoom === id ? null : id)} />)}
        <View className="mt-3"><Button label={t('redesign.showResults', { count: filtered.length })} onPress={() => setFiltersOpen(false)} /></View>
      </BottomSheetModal>
      <AddObjetModal visible={adding} onClose={() => setAdding(false)} />
      <OnboardingGuide visible={onboarding.open} onClose={onboarding.close} />
      <AssistantConsentSheet visible={consent} loading={setConsentMutation.isPending} onAccept={acceptConsent} onCancel={() => setConsent(false)} />
      <AssistantSheet state={assistant} onClose={assistant.stop} onChooseObjet={assistant.chooseObjet}
        onChooseDestination={assistant.chooseDestination} onSkipChoice={assistant.skipChoice} onUndoMove={assistant.undoMove} />
    </View>
  );
}
