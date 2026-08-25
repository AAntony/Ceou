import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { usePullToRefresh } from '../../components/usePullToRefresh';
import { Icon } from '../../components/Icon';
import { GuestBanner } from '../auth/GuestBanner';
import { useIsAnonymous } from '../auth/SessionProvider';
import { AddObjetModal } from '../inventory/AddObjetModal';
import { useProfile } from '../profile/useProfile';
import { ResultCard } from './ResultCard';
import { useSearchIndex, type SearchIndexEntry } from './queries';
import { AssistantFab } from './AssistantFab';
import { AssistantSheet } from '../assistant/AssistantSheet';
import { useAssistant } from '../assistant/useAssistant';
import { normalizeForMatch } from '../../lib/text/match';
import {
  ONE_COLUMN_SCALE,
  STACK_SCALE,
  TWO_COLUMN_SCALE,
  useScaled,
  useTextScale,
} from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';

// En dessous de cette taille, un "mot" est presque toujours un mot de
// liaison (un, le, la, de...) plutôt qu'un vrai terme de recherche — la
// reconnaissance vocale en ajoute plusieurs par phrase ("Un coussin") qui
// casseraient une correspondance sur la phrase entière.
const MIN_SEARCH_WORD_LENGTH = 3;

function searchTermsFor(query: string): string[] {
  const words = normalizeForMatch(query)
    .split(' ')
    .filter((word) => word.length >= MIN_SEARCH_WORD_LENGTH);
  const fallback = normalizeForMatch(query);
  return words.length > 0 ? words : fallback ? [fallback] : [];
}

// Reference stable : passer un litteral [] a `data` creerait un nouveau
// tableau a chaque rendu et ferait retravailler la FlatList pour rien.
const NO_ENTRIES: SearchIndexEntry[] = [];

// L'EN-TETE EST FIGE, LA GRILLE SEULE DEFILE. Recherche, filtres par Piece
// et bouton d'ajout sont les trois commandes de l'ecran : les faire partir
// vers le haut des qu'on parcourt l'inventaire obligeait a remonter toute la
// liste pour changer de filtre ou lancer une recherche.
//
// Le rembourrage haut passe donc de la liste a l'en-tete, et la liste ne
// garde qu'une marge de respiration sous lui.
const HEADER_PADDING = { paddingHorizontal: 24, paddingTop: 64 };
// Le rembourrage bas degage la barre d'onglets ET le bouton de l'assistant,
// qui grandissent tous deux avec le reglage de taille : une valeur figee
// laisserait les dernieres cartes dessous des qu'on agrandit.
const CONTENT_BOTTOM_PADDING = 160;

// TROIS COLONNES, et un ecart FIXE plutot qu'un `justify-between`.
//
// A deux colonnes, `space-between` suffisait : une rangee incomplete n'a
// qu'une carte, qui reste a gauche. A trois, une rangee de deux cartes se
// serait retrouvee collee aux deux bords avec un trou au milieu. L'ecart est
// donc pose explicitement et les cartes gardent leur largeur (w-[31.5%],
// voir ResultCard) : une rangee incomplete se remplit de gauche a droite,
// comme les autres.
const COLUMN_WRAPPER = { gap: 9 };

type HomeHeaderProps = {
  greeting: string;
  /** Vrai quand le texte est assez gros pour que salutation et bouton
      d'ajout cessent de tenir cote a cote. */
  stacked: boolean;
  isGuest: boolean;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  voiceSearch: ReturnType<typeof useAssistant>;
  onAddObjet: () => void;
  pieceOptions: string[];
  selectedPiece: string | null;
  onSelectPiece: (piece: string | null) => void;
};

// EXTRAIT AU NIVEAU DU MODULE, jamais declare dans le corps de
// HomeDashboard. Un composant defini a l'interieur change de TYPE a chaque
// rendu du parent : React demonte alors l'en-tete au lieu de le mettre a
// jour, et le champ de recherche PERD LE FOCUS a chaque caractere tape. Le
// controle le plus utilise de l'app en dependrait.
//
// L'en-tete a d'abord vecu dans `ListHeaderComponent` de la FlatList — il en
// est sorti pour rester fige pendant le defilement. Le garder ici reste
// necessaire pour la raison ci-dessus, independamment de cette histoire.
function HomeHeader({
  greeting,
  stacked,
  isGuest,
  searchText,
  onSearchTextChange,
  voiceSearch,
  onAddObjet,
  pieceOptions,
  selectedPiece,
  onSelectPiece,
}: HomeHeaderProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <>
      <View className={`mb-6 ${stacked ? '' : 'flex-row items-start justify-between'}`}>
        <View className={stacked ? '' : 'flex-1 pr-4'}>
          <Text className="text-title font-bold text-ink">{greeting}</Text>
          <Text className="mt-1 text-label text-ink-soft">{t('home.tagline')}</Text>
        </View>
        {/* Ancien "+" central de la barre d'onglets. Il y annonçait un ajout
            CONTEXTUEL alors qu'il ajoutait toujours un Objet, sur des écrans
            qui ont déjà leur propre bouton "Ajouter" dans l'en-tête natif —
            d'où la confusion signalée par les testeurs. L'Accueil est le seul
            écran SANS contexte, donc le seul où le geste n'a qu'un sens
            possible ; le libellé lève le reste du doute. Profil est parti
            dans la barre d'onglets. `shrink-0` : c'est la salutation qui se
            replie sur deux lignes si la place manque, jamais la pastille —
            jusqu'à ce que le texte grossisse assez pour que les deux ne
            tiennent plus côte à côte, auquel cas le bouton passe dessous et
            prend toute la largeur. */}
        {isGuest ? null : (
        <Pressable
          onPress={onAddObjet}
          accessibilityRole="button"
          className={`flex-row items-center justify-center gap-1.5 rounded-full bg-coral px-3.5 py-2.5 active:opacity-80 ${
            stacked ? 'mt-3 self-stretch' : 'shrink-0'
          }`}
        >
          <Icon name="add" size={18} color="#FFFFFF" />
          <Text numberOfLines={1} className="shrink text-label font-semibold text-white">
            {t('home.add_objet')}
          </Text>
        </Pressable>
        )}
      </View>

      {isGuest ? <GuestBanner /> : null}

      {/* Halo coloré autour du champ plutôt qu'un flou diffus : l'ombre
          colorée façon maquette n'est pas fiable sur Android (elevation
          ne rend qu'une ombre grise), ce cerne fait l'effet sans lib
          supplémentaire ni rendu différent iOS/Android. */}
      <View className="mb-4 rounded-full bg-teal/15 p-[3px]">
        {/* Hauteur MINIMALE et non fixe : le reglage de police du telephone
            grossit le texte du champ sans passer par `rem`, et une hauteur
            en dur l'aurait rogne. Elle vaut toujours 3rem au repos, donc la
            barre ne bouge pas tant qu'on n'agrandit rien. */}
        <View className="min-h-[3rem] flex-row items-center rounded-full border border-teal/30 bg-surface pl-4 pr-2">
          <Icon name="search" size={20} color={colors.inkFaint} />
          <TextInput
            value={searchText}
            onChangeText={onSearchTextChange}
            placeholder={voiceSearch.isListening ? t('home.voice_search_listening') : t('home.search_placeholder')}
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            // `min-w-0` : voir TextField — un <input> web ne retrecit pas
            // sous sa largeur naturelle et pousserait la croix d'effacement
            // hors de la barre.
            className="ml-2 min-w-0 flex-1 text-body text-ink"
          />

          {/* Seulement quand il y a du texte : toujours visible, ce bouton
              serait mort la moitié du temps et se lirait comme un "fermer la
              recherche". */}
          {searchText.length > 0 ? (
            <Pressable
              onPress={() => onSearchTextChange('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
              className="ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-60"
            >
              <Icon name="close" size={18} color={colors.inkFaint} />
            </Pressable>
          ) : null}

        </View>
      </View>

      {pieceOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5 -mx-1" contentContainerClassName="px-1">
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelectPiece(null)}
            android_ripple={{ color: colors.ripple, borderless: false }}
            className={`mr-2 shrink-0 flex-row items-center gap-1.5 self-start overflow-hidden rounded-full border px-4 py-2 ${
              selectedPiece === null ? 'border-teal bg-teal-light' : 'border-ink/10 bg-surface'
            }`}
          >
            <Icon name="home" size={14} color={selectedPiece === null ? colors.tealDark : colors.inkSoft} />
            <Text className={selectedPiece === null ? 'font-semibold text-teal-dark' : 'text-ink-soft'}>
              {t('home.chip_all')}
            </Text>
          </Pressable>
          {pieceOptions.map((pieceName) => {
            const selected = selectedPiece?.toLowerCase() === pieceName.toLowerCase();
            return (
              <Pressable
                accessibilityRole="button"
                key={pieceName}
                onPress={() => onSelectPiece(selected ? null : pieceName)}
                android_ripple={{ color: colors.ripple, borderless: false }}
                className={`mr-2 shrink-0 flex-row items-center gap-1.5 self-start overflow-hidden rounded-full border px-4 py-2 ${
                  selected ? 'border-teal bg-teal-light' : 'border-ink/10 bg-surface'
                }`}
              >
                <Icon name="piece" size={14} color={selected ? colors.tealDark : colors.inkSoft} />
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
  const refreshControl = usePullToRefresh();
  const { t } = useTranslation();
  // Grossissement REEL du texte : choix dans l'app x reglage du telephone.
  // Trois tuiles par rangee ne tiennent pas davantage parce que c'est Android
  // qui a grossi le texte plutot que nous.
  const { textScale } = useTextScale();
  const columns = textScale >= ONE_COLUMN_SCALE ? 1 : textScale >= TWO_COLUMN_SCALE ? 2 : 3;
  const contentPadding = useScaled(CONTENT_BOTTOM_PADDING);
  const { data: profile } = useProfile();
  const { data: entries, isLoading, isError, refetch } = useSearchIndex();

  const [searchText, setSearchText] = useState('');
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [addObjetOpen, setAddObjetOpen] = useState(false);
  // Le micro devient l ASSISTANT et non plus une simple dictee : taper la
  // phrase entendue dans le champ de recherche echouait des qu on posait une
  // vraie question (« ou sont mes cles ? » etait cherche mot pour mot). Les
  // dictees courtes restent une recherche texte, sans appel IA (voir
  // DIRECT_SEARCH_MAX_WORDS).
  const voiceSearch = useAssistant();

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
      ? list.filter((entry) => {
          const name = normalizeForMatch(entry.name);
          return searchTerms.some((term) => name.includes(term));
        })
      : list.filter((entry) => entry.kind === 'objet');

    if (selectedPiece) {
      list = list.filter((entry) => entry.piece_name.trim().toLowerCase() === selectedPiece.toLowerCase());
    }

    // Ordre alphabétique, et pas celui que renvoie search_index() : cette
    // fonction assemble quatre requêtes par UNION, son ordre n'est donc ni
    // défini ni stable d'un chargement à l'autre. Sur une grille qu'on
    // parcourt des yeux pour retrouver un objet, un ordre imprévisible est
    // ce qui coûte le plus cher.
    //
    // `sensitivity: 'base'` range « École » avec « ecole » plutôt que de
    // remonter toutes les majuscules et les accents en tête ; `numeric`
    // place « Boîte 2 » avant « Boîte 10 », ce que l'ordre texte inverse.
    //
    // Copie avant tri : `list` vient d'un filtre donc c'est déjà un nouveau
    // tableau, mais trier en place ce qui pourrait un jour être le tableau
    // du cache le corromprait sans bruit.
    return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
  }, [entries, trimmedSearch, searchTerms, selectedPiece]);

  const isGuest = useIsAnonymous();

  const greeting = profile?.display_name
    ? t('home.greeting', { name: profile.display_name })
    : t('home.greeting_anonymous');

  const renderItem = useCallback(
    ({ item }: { item: SearchIndexEntry }) => <ResultCard entry={item} columns={columns} />,
    [columns],
  );

  return (
    <View className="flex-1 bg-sand">
      {/* Hors de la FlatList, donc hors du defilement. Il etait auparavant
          passe a `ListHeaderComponent`, ce qui le faisait defiler avec les
          cartes. */}
      <View style={HEADER_PADDING}>
        <HomeHeader
          greeting={greeting}
          stacked={textScale >= STACK_SCALE}
          isGuest={isGuest}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          voiceSearch={voiceSearch}
          onAddObjet={() => setAddObjetOpen(true)}
          pieceOptions={pieceOptions}
          selectedPiece={selectedPiece}
          onSelectPiece={setSelectedPiece}
        />
      </View>

      {/* Virtualisé (lot 4) : c'est la SEULE liste non bornée de l'app — elle
          agrège tous les objets de toutes les habitations favorites, alors
          que les autres écrans listent le contenu d'une pièce ou d'un tiroir
          (une dizaine d'éléments, pour lesquels une FlatList coûterait plus
          qu'elle ne rapporte). Avant, chaque objet était monté d'emblée :
          ~7 vues natives et une requête d'image par carte. */}
      <FlatList
        // REMONTAGE VOLONTAIRE quand le nombre de colonnes change : une
        // FlatList refuse de changer `numColumns` en cours de route (elle
        // leve « Changing numColumns on the fly is not supported »).
        key={columns}
        refreshControl={refreshControl}
        data={isError ? NO_ENTRIES : filtered}
        renderItem={renderItem}
        keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
        numColumns={columns}
        // Interdit sur une liste a une seule colonne, et pas seulement
        // inutile : la FlatList leve une erreur si les deux coexistent.
        columnWrapperStyle={columns > 1 ? COLUMN_WRAPPER : undefined}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: contentPadding }}
        // Assez pour remplir le premier ecran sans laisser un blanc au
        // premier rendu — donc proportionnel au nombre de colonnes.
        initialNumToRender={columns * 5}
        windowSize={5}
        ListEmptyComponent={
          isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : !isLoading ? (
            <EmptyState icon="search" title={trimmedSearch ? t('home.no_results') : t('home.empty')} />
          ) : null
        }
      />

      {/* Montée ici plutôt que dans AppTabBar : l'ajout "depuis n'importe où"
          n'existe plus, il appartient maintenant à cet écran. */}
      <AddObjetModal visible={addObjetOpen} onClose={() => setAddObjetOpen(false)} />

      {/* Au-dessus de la barre d'onglets, dans la zone du pouce : la
          pastille micro vivait dans le champ de recherche, tout en haut de
          l'écran, là où l'utilisateur la trouvait trop discrète et où elle
          demandait de changer de prise en main pour l'atteindre. */}
      <AssistantFab active={voiceSearch.active} onPress={voiceSearch.active ? voiceSearch.stop : voiceSearch.start} />

      <AssistantSheet
        state={voiceSearch}
        onClose={voiceSearch.stop}
        onChooseObjet={voiceSearch.chooseObjet}
        onChooseDestination={voiceSearch.chooseDestination}
        onSkipChoice={voiceSearch.skipChoice}
        onUndoMove={voiceSearch.undoMove}
      />
    </View>
  );
}
