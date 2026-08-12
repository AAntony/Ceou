import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PresetPicker } from '../../components/PresetPicker';
import { HABITATION_TYPES, type HabitationTypeKey } from '../inventory/constants';
import { useCreateHabitation } from '../inventory/queries';
import { useProfile } from '../profile/useProfile';
import { ResultCard } from './ResultCard';
import { useSearchIndex } from './queries';

export function HomeDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { data: entries, isLoading } = useSearchIndex();
  const createHabitation = useCreateHabitation();

  const [searchText, setSearchText] = useState('');
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<HabitationTypeKey>('maison');

  const pieceOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (entries ?? []).forEach((entry) => {
      const key = entry.piece_name.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, entry.piece_name);
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const trimmedSearch = searchText.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = entries ?? [];
    // Grille par défaut = objets uniquement ; une recherche texte élargit
    // aux conteneurs/emplacements/pièces correspondants.
    list = trimmedSearch
      ? list.filter((entry) => entry.name.toLowerCase().includes(trimmedSearch))
      : list.filter((entry) => entry.kind === 'objet');

    if (selectedPiece) {
      list = list.filter((entry) => entry.piece_name.trim().toLowerCase() === selectedPiece.toLowerCase());
    }
    return list;
  }, [entries, trimmedSearch, selectedPiece]);

  const greeting = profile?.display_name
    ? t('home.greeting', { name: profile.display_name })
    : t('home.greeting_anonymous');

  const openCreateHabitation = () => {
    setType('maison');
    setModalOpen(true);
  };

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-40 pt-16">
        <View className="mb-6 flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-2xl font-bold text-ink">{greeting}</Text>
            <Text className="mt-1 text-sm text-ink-soft">{t('home.tagline')}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/habitations')}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full bg-white active:opacity-70"
          >
            <Icon name="home" size={20} color="#2D2A26" />
          </Pressable>
        </View>

        <View className="mb-4 flex-row items-center rounded-full border border-ink/10 bg-white px-4 py-3">
          <Icon name="search" size={20} color="#A39C8F" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('home.search_placeholder')}
            placeholderTextColor="#A39C8F"
            autoCapitalize="none"
            autoCorrect={false}
            className="ml-2 flex-1 text-base text-ink"
          />
        </View>

        {pieceOptions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5 -mx-1" contentContainerClassName="px-1">
            <Pressable
              onPress={() => setSelectedPiece(null)}
              className={`mr-2 rounded-full border px-4 py-2 ${
                selectedPiece === null ? 'border-coral bg-coral' : 'border-ink/10 bg-white'
              }`}
            >
              <Text className={selectedPiece === null ? 'font-semibold text-white' : 'text-ink-soft'}>
                {t('home.chip_all')}
              </Text>
            </Pressable>
            {pieceOptions.map((pieceName) => {
              const selected = selectedPiece?.toLowerCase() === pieceName.toLowerCase();
              return (
                <Pressable
                  key={pieceName}
                  onPress={() => setSelectedPiece(selected ? null : pieceName)}
                  className={`mr-2 rounded-full border px-4 py-2 ${
                    selected ? 'border-coral bg-coral' : 'border-ink/10 bg-white'
                  }`}
                >
                  <Text className={selected ? 'font-semibold text-white' : 'text-ink-soft'}>{pieceName}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title={trimmedSearch ? t('home.no_results') : t('home.empty')}
          />
        ) : (
          <View className="flex-row flex-wrap justify-between">
            {filtered.map((entry, index) => (
              <ResultCard key={`${entry.kind}-${entry.id}`} entry={entry} colorIndex={index} />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={openCreateHabitation}
        className="absolute h-14 w-14 items-center justify-center rounded-full bg-coral shadow-lg active:opacity-80"
        style={{ right: 24, bottom: insets.bottom + 84 }}
      >
        <Icon name="add" size={26} color="#fff" />
      </Pressable>

      <CreateEntityModal
        visible={modalOpen}
        title={t('inventory.habitations.create_title')}
        nameLabel={t('inventory.habitations.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        loading={createHabitation.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (name) => {
          const definition = HABITATION_TYPES.find((h) => h.key === type)!;
          await createHabitation.mutateAsync({ name, type, icon: definition.icon });
          setModalOpen(false);
        }}
      >
        <PresetPicker
          presets={HABITATION_TYPES}
          selectedKey={type}
          onSelect={(key) => setType(key as HabitationTypeKey)}
          labelFor={(key) => t(`inventory.habitationTypes.${key}`)}
        />
      </CreateEntityModal>
    </View>
  );
}
