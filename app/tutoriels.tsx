import type { TFunction } from 'i18next';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSpaceForAppTabBar } from '../src/components/AppTabBar';
import { Icon } from '../src/components/Icon';
import { IconBadge } from '../src/components/IconBadge';
import { TextField } from '../src/components/TextField';
import { CHAPITRES, cleDe, rangDe, type Chapitre } from '../src/features/tutoriels/chapitres';
import { useChapitresLus } from '../src/features/tutoriels/progression';
import { useThemeColors } from '../src/lib/theme';

// LE SOMMAIRE DES TUTORIELS.
//
// CE QU'IL AJOUTE AU GUIDE DE DÉMARRAGE, qui existait déjà : le guide se fait
// UNE FOIS, le premier jour, et il apprend à ranger. Il ne dit rien des
// factures, du partage, des prêts ni du plan — c'est-à-dire de presque tout
// ce que l'app sait faire aujourd'hui. Et quand on veut vérifier un détail
// trois semaines plus tard, on ne va pas refaire un guide qui crée une
// habitation.
//
// UN ÉCRAN SOMMAIRE, PAS UN MENU LATÉRAL. Un tiroir coulissant est l'idiome
// d'une documentation de bureau ; sur 375 points de large il mange la largeur
// du texte qu'on vient lire, et ajoute un geste à apprendre. Une liste de
// chapitres puis le chapitre en plein écran, c'est ce que fait toute
// application de lecture sur téléphone — et c'est déjà la façon dont on
// circule dans le reste de Céoù.
//
// LA PROGRESSION N'EST PAS UN SCORE. Elle répond à une seule question : « par
// où j'en étais ? ». D'où la coche sur les chapitres lus et rien de plus —
// pas de pourcentage, pas de félicitations.

export default function TutorielsScreen() {
  const { t } = useTranslation();
  const [recherche, setRecherche] = useState('');
  const lus = useChapitresLus();

  // LA BARRE D'ONGLETS EST RENDUE PAR-DESSUS TOUT L'ÉCRAN (voir
  // app/_layout.tsx) : sans cette réserve, le dernier chapitre se termine
  // dessous.
  const espaceBarre = useSpaceForAppTabBar();

  // LA RECHERCHE PORTE SUR TOUT LE CHAPITRE, pas sur son titre. Quelqu'un
  // cherche « garantie » ou « assureur » — des mots qui sont dans les étapes
  // et dans l'astuce, jamais dans le titre.
  const chapitres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return CHAPITRES;
    return CHAPITRES.filter((chapitre) => texteCherchable(t, chapitre).includes(terme));
  }, [recherche, t]);

  const nombreLus = CHAPITRES.filter((chapitre) => lus.has(chapitre.id)).length;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('tutoriels.title') }} />

      <ScrollView
        className="flex-1 bg-sand"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: espaceBarre + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-label leading-5 text-ink-soft">{t('tutoriels.intro')}</Text>

        <Text className="mb-4 mt-3 text-caption font-semibold uppercase tracking-wide text-ink-faint">
          {nombreLus === CHAPITRES.length
            ? t('tutoriels.progress_all')
            : t('tutoriels.progress', { count: nombreLus, total: CHAPITRES.length })}
        </Text>

        <TextField
          label={t('tutoriels.search')}
          value={recherche}
          onChangeText={setRecherche}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {chapitres.length === 0 ? (
          <Text className="mt-6 text-center text-label text-ink-soft">{t('tutoriels.search_empty')}</Text>
        ) : (
          // LE NUMÉRO EST CELUI DU CHAPITRE, PAS SA PLACE DANS LA LISTE
          // AFFICHÉE. Une recherche qui ne rend que le second chapitre
          // l'annonçait « 1. » — le numéro devenait un mensonge au moment
          // précis où il sert à se repérer.
          chapitres.map((chapitre) => (
            <CarteChapitre key={chapitre.id} chapitre={chapitre} rang={rangDe(chapitre.id)} lu={lus.has(chapitre.id)} />
          ))
        )}
      </ScrollView>
    </>
  );
}

function CarteChapitre({ chapitre, rang, lu }: { chapitre: Chapitre; rang: number; lu: boolean }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const titre = t(cleDe(chapitre, 'title'));

  return (
    <Pressable
      accessibilityRole="button"
      // CE QUE LE GESTE FAIT, pas ce que la carte montre : lire « Bien
      // démarrer » à voix haute ne dit pas qu'on ouvre un tutoriel.
      accessibilityLabel={t('tutoriels.open_chapter', { name: titre })}
      onPress={() => router.push(`/tutoriel/${chapitre.id}`)}
      className="mb-3 flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3 active:opacity-70"
    >
      <IconBadge icon={chapitre.icon} fill={colors.accentLight} iconColor={colors.accentDark} size={40} />

      {/* NI TITRE NI RÉSUMÉ NE SONT TRONQUÉS : la carte grandit plutôt que de
          couper. Une liste d'articles n'a pas à être d'aplomb — ce qui compte
          est de savoir ce qu'on va lire avant d'appuyer, et un titre coupé au
          milieu d'un mot le dit moins bien qu'une carte un peu plus haute. */}
      <View className="flex-1">
        <Text className="text-body font-semibold text-ink">
          {rang}. {titre}
        </Text>
        <Text className="text-caption leading-4 text-ink-soft">{t(cleDe(chapitre, 'summary'))}</Text>
      </View>

      {lu ? <Icon name="validate" size={18} color={colors.tealDark} /> : null}
      <Icon name="chevron" size={20} color={colors.inkFaint} />
    </Pressable>
  );
}

/**
 * Tout le texte d'un chapitre, mis à plat pour la recherche.
 *
 * Les étapes arrivent en tableau depuis i18n ; `returnObjects` est ce qui
 * permet de les lire d'un bloc, et le repli sur une chaîne vide évite qu'une
 * clé manquante ne fasse échouer une recherche.
 */
function texteCherchable(t: TFunction, chapitre: Chapitre): string {
  const morceaux = ['title', 'summary', 'goal', 'tip', 'result'].map((suffixe) => t(cleDe(chapitre, suffixe)));

  const etapes: unknown = t(cleDe(chapitre, 'steps'), { returnObjects: true });
  if (Array.isArray(etapes)) morceaux.push(...etapes.filter((etape): etape is string => typeof etape === 'string'));

  return morceaux.join(' ').toLowerCase();
}
