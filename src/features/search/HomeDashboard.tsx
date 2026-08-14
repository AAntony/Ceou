import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { useProfile } from '../profile/useProfile';
import { ResultCard } from './ResultCard';
import { useSearchIndex } from './queries';
import { useVoiceSearch } from './useVoiceSearch';

export function HomeDashboard() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: entries, isLoading } = useSearchIndex();

  const [searchText, setSearchText] = useState('');
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const voiceSearch = useVoiceSearch(setSearchText);

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

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-40 pt-16">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-ink">{greeting}</Text>
          <Text className="mt-1 text-sm text-ink-soft">{t('home.tagline')}</Text>
        </View>

        {/* Halo coloré autour du champ plutôt qu'un flou diffus : l'ombre
            colorée façon maquette n'est pas fiable sur Android (elevation
            ne rend qu'une ombre grise), ce cerne fait l'effet sans lib
            supplémentaire ni rendu différent iOS/Android. */}
        <View className="mb-4 rounded-full bg-teal/15 p-[3px]">
          <View className="flex-row items-center rounded-full border border-teal/30 bg-white px-4 py-3">
            <Icon name="search" size={20} color="#A39C8F" />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={voiceSearch.isListening ? t('home.voice_search_listening') : t('home.search_placeholder')}
              placeholderTextColor="#A39C8F"
              autoCapitalize="none"
              autoCorrect={false}
              className="ml-2 flex-1 text-base text-ink"
            />
            <Pressable
              onPress={voiceSearch.isListening ? voiceSearch.stop : voiceSearch.start}
              hitSlop={8}
              className="ml-2"
            >
              <Icon name="microphone" size={20} color={voiceSearch.isListening ? '#FF6B4A' : '#A39C8F'} />
            </Pressable>
          </View>
        </View>

        {pieceOptions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5 -mx-1" contentContainerClassName="px-1">
            <Pressable
              onPress={() => setSelectedPiece(null)}
              android_ripple={{ color: 'rgba(45,42,38,0.08)', borderless: false }}
              className={`mr-2 shrink-0 flex-row items-center gap-1.5 self-start overflow-hidden rounded-full border px-4 py-2 ${
                selectedPiece === null ? 'border-teal bg-teal-light' : 'border-ink/10 bg-white'
              }`}
            >
              <Icon name="home" size={14} color={selectedPiece === null ? '#219488' : '#6B6459'} />
              <Text className={selectedPiece === null ? 'font-semibold text-teal-dark' : 'text-ink-soft'}>
                {t('home.chip_all')}
              </Text>
            </Pressable>
            {pieceOptions.map((pieceName) => {
              const selected = selectedPiece?.toLowerCase() === pieceName.toLowerCase();
              return (
                <Pressable
                  key={pieceName}
                  onPress={() => setSelectedPiece(selected ? null : pieceName)}
                  android_ripple={{ color: 'rgba(45,42,38,0.08)', borderless: false }}
                  className={`mr-2 shrink-0 flex-row items-center gap-1.5 self-start overflow-hidden rounded-full border px-4 py-2 ${
                    selected ? 'border-teal bg-teal-light' : 'border-ink/10 bg-white'
                  }`}
                >
                  <Icon name="piece" size={14} color={selected ? '#219488' : '#6B6459'} />
                  <Text className={selected ? 'font-semibold text-teal-dark' : 'text-ink-soft'}>{pieceName}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {!isLoading && filtered.length === 0 ? (
          <EmptyState icon="search" title={trimmedSearch ? t('home.no_results') : t('home.empty')} />
        ) : (
          <View className="flex-row flex-wrap justify-between">
            {filtered.map((entry, index) => (
              <ResultCard key={`${entry.kind}-${entry.id}`} entry={entry} colorIndex={index} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
