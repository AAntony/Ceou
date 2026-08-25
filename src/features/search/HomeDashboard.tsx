import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { usePullToRefresh } from '../../components/usePullToRefresh';
import { Icon } from '../../components/Icon';
import { GuestBanner } from '../auth/GuestBanner';
import { useIsAnonymous } from '../auth/SessionProvider';
import { AddObjetModal } from '../inventory/AddObjetModal';
import { OnboardingGuide } from '../onboarding/OnboardingGuide';
import { useOnboardingLaunch } from '../onboarding/useOnboarding';
import { useProfile } from '../profile/useProfile';
import { ResultCard } from './ResultCard';
import { useSearchIndex, type SearchIndexEntry } from './queries';
import { AssistantFab } from './AssistantFab';
import { AssistantSheet } from '../assistant/AssistantSheet';
import { useAssistant } from '../assistant/useAssistant';
import { normalizeForMatch } from '../../lib/text/match';
import {
  ONE_COLUMN_SCALE,
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

// L'EN-TÊTE EST UN CALQUE POSÉ SUR LA LISTE, PAS UN BLOC AU-DESSUS D'ELLE.
//
// C'est ce qui distingue ce montage des trois précédents, tous défaillants :
// la liste occupe TOUTE la hauteur de l'écran et ne change JAMAIS de taille.
// Sa course de défilement est donc constante, et la boucle qui faisait
// clignoter la salutation — replier le bloc rendait de la hauteur à la liste,
// ce qui déplaçait le défilement, ce qui rouvrait le bloc — n'a tout
// simplement plus de prise.
//
// Le calque glisse vers le haut de la hauteur EXACTE de la salutation, pas
// plus : la recherche et les filtres viennent alors se poser sous la barre
// d'état et n'en bougent plus. La salutation, elle, passe derrière le bandeau
// opaque du haut et disparaît progressivement, liée au doigt image par image.
//
// Le glissement est calculé par le PILOTE NATIF : il ne traverse jamais le
// fil JavaScript, donc aucune saccade même pendant que la liste monte des
// cartes.
//
// Hauteur du bandeau opaque qui coiffe le calque. Il dégage la barre d'état,
// et c'est aussi lui qui AVALE la salutation : elle glisse derrière lui, donc
// elle a disparu au moment précis où la recherche arrive en haut.
const HEADER_TOP_INSET = 64;
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

// LE SEUL BLOC QUI GLISSE : le texte d'accueil, et rien d'autre.
//
// Le bouton d'ajout en a été SORTI (il l'accompagnait jusqu'ici) et rejoint
// la rangée de recherche, qui ne bouge pas. C'est la contrainte posée à
// l'usage : ce qui glisse finit par être hors d'atteinte, et l'ajout d'un
// objet est la seule action que cet écran propose.
//
// Le texte y gagne toute la largeur, que la pastille lui disputait — et la
// phrase d'accroche cesse de se replier sur trois lignes en gros texte.
function GreetingText({ greeting }: { greeting: string }) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="text-title font-bold text-ink">{greeting}</Text>
      <Text className="mt-1 text-label text-ink-soft">{t('home.tagline')}</Text>
    </View>
  );
}

type HomeHeaderProps = {
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
      {isGuest ? <GuestBanner /> : null}

      {/* LA RANGÉE QUI NE BOUGE JAMAIS : chercher, et ajouter.
          Le bouton d'ajout accompagnait la salutation ; il l'a quittée pour
          venir ici, parce que la salutation glisse et que lui doit rester
          sous le pouce. */}
      <View className="mb-4 flex-row items-center gap-2">
      {/* Halo coloré autour du champ plutôt qu'un flou diffus : l'ombre
          colorée façon maquette n'est pas fiable sur Android (elevation
          ne rend qu'une ombre grise), ce cerne fait l'effet sans lib
          supplémentaire ni rendu différent iOS/Android. */}
      <View className="flex-1 rounded-full bg-teal/15 p-[3px]">
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

        {/* Pastille ronde plutôt que la pastille libellée d'avant : à côté du
            champ, un libellé complet ne laisserait plus de place où écrire.
            Le lecteur d'écran, lui, garde la phrase entière.
            `self-stretch` + carré : elle prend exactement la hauteur de la
            barre de recherche, quelle que soit la taille du texte. */}
        {isGuest ? null : (
          <Pressable
            onPress={onAddObjet}
            accessibilityRole="button"
            accessibilityLabel={t('home.add_objet')}
            style={{ aspectRatio: 1 }}
            className="items-center justify-center self-stretch rounded-full bg-coral active:opacity-80"
          >
            <Icon name="add" size={24} color="#FFFFFF" />
          </Pressable>
        )}
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

// L'INVITATION AU GUIDE, posée dans l'écran vide de l'accueil.
//
// C'est le rattrapage de ceux qui ont répondu « plus tard » : le guide ne
// s'ouvre plus tout seul, mais il reste à portée là où le manque se fait
// sentir. Elle disparaît dès qu'une habitation existe — à ce moment-là,
// l'accueil vide veut dire « aucun objet », plus « je ne sais pas commencer ».
function GuideInvite({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border-2 border-coral bg-coral-light px-4 py-4 active:opacity-70"
    >
      <Icon name="guide" size={26} color={colors.accentDark} />
      <View className="flex-1">
        <Text className="text-body font-bold text-coral-dark">{t('onboarding.entry_title')}</Text>
        <Text className="mt-0.5 text-label text-coral-dark/80">{t('onboarding.entry_hint')}</Text>
      </View>
    </Pressable>
  );
}

export function HomeDashboard() {
  const { t } = useTranslation();
  // Grossissement REEL du texte : choix dans l'app x reglage du telephone.
  // Trois tuiles par rangee ne tiennent pas davantage parce que c'est Android
  // qui a grossi le texte plutot que nous.
  const { textScale } = useTextScale();
  const columns = textScale >= ONE_COLUMN_SCALE ? 1 : textScale >= TWO_COLUMN_SCALE ? 2 : 3;
  const contentPadding = useScaled(CONTENT_BOTTOM_PADDING);

  // Les deux mesures dont dépend le calque. Elles sont FIABLES ici, alors
  // qu'une mesure avait ruiné la version repliable : rien n'est jamais
  // comprimé, le calque ne fait que glisser, donc `onLayout` rapporte
  // toujours la vraie hauteur — y compris quand le réglage de taille du
  // texte change.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [greetingHeight, setGreetingHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  // `Math.max(..., 1)` : une plage d'interpolation doit être strictement
  // croissante, et la hauteur vaut zéro avant la première mesure.
  const slide = Math.max(greetingHeight, 1);
  const headerTranslate = scrollY.interpolate({
    inputRange: [0, slide],
    outputRange: [0, -slide],
    // `clamp` des deux côtés : au-delà le calque reste en place, et un
    // « tirer pour rafraîchir » (offset négatif) ne le fait pas redescendre.
    extrapolate: 'clamp',
  });
  // La salutation s'efface avant d'avoir fini de glisser : elle a disparu
  // quand elle atteint le bandeau, plutôt que de sembler s'y engouffrer.
  const greetingOpacity = scrollY.interpolate({
    inputRange: [0, slide * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Décalé de la hauteur du calque : sans ça, le rouleau tournerait DERRIÈRE
  // lui et le geste paraîtrait sans effet.
  const refreshControl = usePullToRefresh(headerHeight);

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
  // Le guide de démarrage : il s'ouvre de lui-même à la toute première
  // utilisation, et reste ensuite accessible depuis l'écran vide ci-dessous.
  const onboarding = useOnboardingLaunch();

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
      {/* Virtualisé (lot 4) : c'est la SEULE liste non bornée de l'app — elle
          agrège tous les objets de toutes les habitations favorites, alors
          que les autres écrans listent le contenu d'une pièce ou d'un tiroir
          (une dizaine d'éléments, pour lesquels une FlatList coûterait plus
          qu'elle ne rapporte). Avant, chaque objet était monté d'emblée :
          ~7 vues natives et une requête d'image par carte.

          Elle occupe TOUTE la hauteur et passe SOUS le calque d'en-tête : sa
          taille ne change jamais, donc sa course de défilement non plus. La
          place de l'en-tête lui est rendue par un rembourrage haut, pas par
          un voisin qui grandit et rétrécit. */}
      <Animated.FlatList
        // REMONTAGE VOLONTAIRE quand le nombre de colonnes change : une
        // FlatList refuse de changer `numColumns` en cours de route (elle
        // leve « Changing numColumns on the fly is not supported »).
        key={columns}
        refreshControl={refreshControl}
        data={isError ? NO_ENTRIES : filtered}
        renderItem={renderItem}
        keyExtractor={(entry: SearchIndexEntry) => `${entry.kind}-${entry.id}`}
        // Le défilement alimente directement la valeur animée, SUR LE FIL
        // NATIF : le glissement de l'en-tête ne dépend donc jamais de la
        // disponibilité du JavaScript, y compris pendant que la liste monte
        // de nouvelles cartes.
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        // Invisible tant que le calque n'est pas mesuré : une seule image,
        // le temps d'éviter de montrer les cartes sous l'en-tête avant que
        // le rembourrage ne soit connu.
        style={{ opacity: headerHeight === 0 ? 0 : 1 }}
        numColumns={columns}
        // Interdit sur une liste a une seule colonne, et pas seulement
        // inutile : la FlatList leve une erreur si les deux coexistent.
        columnWrapperStyle={columns > 1 ? COLUMN_WRAPPER : undefined}
        // Le rembourrage haut vaut la hauteur du calque : c'est lui qui rend
        // sa place à l'en-tête, sans que la liste change de taille pour
        // autant.
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: headerHeight + 4,
          paddingBottom: contentPadding,
        }}
        // Assez pour remplir le premier ecran sans laisser un blanc au
        // premier rendu — donc proportionnel au nombre de colonnes.
        initialNumToRender={columns * 5}
        windowSize={5}
        ListEmptyComponent={
          isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : !isLoading ? (
            <EmptyState
              icon="search"
              title={trimmedSearch ? t('home.no_results') : t('home.empty')}
              action={!trimmedSearch && onboarding.canOffer ? <GuideInvite onPress={onboarding.start} /> : undefined}
            />
          ) : null
        }
      />

      {/* LE CALQUE. Posé après la liste, donc peint par-dessus elle. Il porte
          son propre fond opaque : les cartes passent derrière sans qu'on les
          devine. */}
      <Animated.View
        className="absolute left-0 right-0 top-0 bg-sand"
        // Même retrait latéral que la liste, au point près : `px-6` vaudrait
        // 21 points et suivrait le réglage de taille, alors que la liste est
        // à 24 en dur — les deux se désaligneraient.
        style={{ paddingHorizontal: 24, transform: [{ translateY: headerTranslate }] }}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <View style={{ height: HEADER_TOP_INSET }} />
        <Animated.View
          style={{ opacity: greetingOpacity }}
          onLayout={(event) => setGreetingHeight(event.nativeEvent.layout.height)}
        >
          <GreetingText greeting={greeting} />
        </Animated.View>
        <HomeHeader
          isGuest={isGuest}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          voiceSearch={voiceSearch}
          onAddObjet={() => setAddObjetOpen(true)}
          pieceOptions={pieceOptions}
          selectedPiece={selectedPiece}
          onSelectPiece={setSelectedPiece}
        />
      </Animated.View>

      {/* LE BANDEAU QUI AVALE LA SALUTATION. Posé après le calque, donc
          au-dessus de lui : la salutation qui glisse vers le haut disparaît
          derrière, au lieu de rester visible au ras de la barre d'état.
          `pointerEvents="none"` — c'est un cache, pas une surface. */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 top-0 bg-sand"
        style={{ height: HEADER_TOP_INSET }}
      />

      {/* Montée ici plutôt que dans AppTabBar : l'ajout "depuis n'importe où"
          n'existe plus, il appartient maintenant à cet écran. */}
      <AddObjetModal visible={addObjetOpen} onClose={() => setAddObjetOpen(false)} />

      {/* Le guide de démarrage. Il vit ICI et pas à la racine parce que
          l'écran d'accueil est exactement l'endroit où quelqu'un qui découvre
          l'app se retrouve bloqué : une recherche, et rien à chercher. */}
      <OnboardingGuide visible={onboarding.open} onClose={onboarding.close} />

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
