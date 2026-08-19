import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Icon } from '../../components/Icon';
import { useProfile } from '../profile/useProfile';
import { ResultCard } from './ResultCard';
import { useSearchIndex, type SearchIndexEntry } from './queries';
import { useVoiceSearch } from './useVoiceSearch';

// En dessous de cette taille, un "mot" est presque toujours un mot de
// liaison (un, le, la, de...) plutôt qu'un vrai terme de recherche — la
// reconnaissance vocale en ajoute plusieurs par phrase ("Un coussin") qui
// casseraient une correspondance sur la phrase entière.
const MIN_SEARCH_WORD_LENGTH = 3;

function searchTermsFor(query: string): string[] {
  const words = query.split(/\s+/).filter((word) => word.length >= MIN_SEARCH_WORD_LENGTH);
  return words.length > 0 ? words : query ? [query] : [];
}

// Reference stable : passer un litteral [] a `data` creerait un nouveau
// tableau a chaque rendu et ferait retravailler la FlatList pour rien.
const NO_ENTRIES: SearchIndexEntry[] = [];

// Reprend a l'identique les paddings de l'ancien ScrollView (px-6 pt-16
// pb-40 = 24 / 64 / 160 px). En style explicite plutot qu'en className :
// `contentContainerClassName` est un cas particulier de NativeWind et cet
// ecran est le premier du projet a utiliser une FlatList — on ne fait pas
// reposer la mise en page de l'ecran d'accueil sur ce pari.
const CONTENT_PADDING = { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 160 };

// Reproduit le `justify-between` de EntityGrid, que numColumns remplace par
// son propre conteneur de rangee. Les cartes restent en w-[48%].
const COLUMN_WRAPPER = { justifyContent: 'space-between' as const };

type HomeHeaderProps = {
  greeting: string;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  voiceSearch: ReturnType<typeof useVoiceSearch>;
  pieceOptions: string[];
  selectedPiece: string | null;
  onSelectPiece: (piece: string | null) => void;
};

// EXTRAIT AU NIVEAU DU MODULE, ET PASSE A `ListHeaderComponent` SOUS FORME
// D'ELEMENT (<HomeHeader ... />), PAS DE FONCTION.
// Une fonction flechee inline (`ListHeaderComponent={() => <View>...}`) cree
// un nouveau type de composant a chaque rendu : React demonte puis remonte
// tout l'en-tete, et le champ de recherche PERD LE FOCUS a chaque caractere
// tape. C'est le piege classique de cette conversion, et il toucherait ici
// le controle le plus utilise de l'app. Garder ce composant hors du corps de
// HomeDashboard est ce qui garantit un type stable.
function HomeHeader({
  greeting,
  searchText,
  onSearchTextChange,
  voiceSearch,
  pieceOptions,
  selectedPiece,
  onSelectPiece,
}: HomeHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <View className="mb-6 flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-2xl font-bold text-ink">{greeting}</Text>
          <Text className="mt-1 text-sm text-ink-soft">{t('home.tagline')}</Text>
        </View>
        {/* Profil déménagé ici (icône discrète) — le bouton "Amis" prend
            sa place dans la barre d'onglets, plus utilisé au quotidien. */}
        <Pressable
          onPress={() => router.navigate('/profile')}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <Icon name="profile" size={22} color="#2D2A26" />
        </Pressable>
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
            onChangeText={onSearchTextChange}
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
            onPress={() => onSelectPiece(null)}
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
                onPress={() => onSelectPiece(selected ? null : pieceName)}
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
    </>
  );
}

export function HomeDashboard() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: entries, isLoading, isError, refetch } = useSearchIndex();

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
  const searchTerms = useMemo(() => searchTermsFor(trimmedSearch), [trimmedSearch]);

  const filtered = useMemo(() => {
    let list = entries ?? [];
    // Grille par défaut = objets uniquement ; une recherche texte élargit
    // aux conteneurs/emplacements/pièces correspondants. Un résultat
    // correspond dès qu'UN SEUL terme de recherche apparaît dans le nom
    // (pas besoin que la phrase entière corresponde) — sinon "Un coussin"
    // ne retrouverait jamais l'objet "Coussin".
    list = trimmedSearch
      ? list.filter((entry) => searchTerms.some((term) => entry.name.toLowerCase().includes(term)))
      : list.filter((entry) => entry.kind === 'objet');

    if (selectedPiece) {
      list = list.filter((entry) => entry.piece_name.trim().toLowerCase() === selectedPiece.toLowerCase());
    }
    return list;
  }, [entries, trimmedSearch, searchTerms, selectedPiece]);

  const greeting = profile?.display_name
    ? t('home.greeting', { name: profile.display_name })
    : t('home.greeting_anonymous');

  const renderItem = useCallback(
    ({ item }: { item: SearchIndexEntry }) => <ResultCard entry={item} />,
    [],
  );

  return (
    <View className="flex-1 bg-sand">
      {/* Virtualisé (lot 4) : c'est la SEULE liste non bornée de l'app — elle
          agrège tous les objets de toutes les habitations favorites, alors
          que les autres écrans listent le contenu d'une pièce ou d'un tiroir
          (une dizaine d'éléments, pour lesquels une FlatList coûterait plus
          qu'elle ne rapporte). Avant, chaque objet était monté d'emblée :
          ~7 vues natives et une requête d'image par carte. */}
      <FlatList
        data={isError ? NO_ENTRIES : filtered}
        renderItem={renderItem}
        keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
        numColumns={2}
        columnWrapperStyle={COLUMN_WRAPPER}
        contentContainerStyle={CONTENT_PADDING}
        initialNumToRender={10}
        windowSize={5}
        ListHeaderComponent={
          <HomeHeader
            greeting={greeting}
            searchText={searchText}
            onSearchTextChange={setSearchText}
            voiceSearch={voiceSearch}
            pieceOptions={pieceOptions}
            selectedPiece={selectedPiece}
            onSelectPiece={setSelectedPiece}
          />
        }
        ListEmptyComponent={
          isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : !isLoading ? (
            <EmptyState icon="search" title={trimmedSearch ? t('home.no_results') : t('home.empty')} />
          ) : null
        }
      />
    </View>
  );
}
