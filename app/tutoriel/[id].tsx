import type { TFunction } from 'i18next';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSpaceForAppTabBar } from '../../src/components/AppTabBar';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { Icon } from '../../src/components/Icon';
import { OnboardingGuide } from '../../src/features/onboarding/OnboardingGuide';
import { Demo } from '../../src/features/tutoriels/Demos';
import { CHAPITRES, chapitreParId, cleDe, rangDe, voisins } from '../../src/features/tutoriels/chapitres';
import { marquerLu, useChapitresLus } from '../../src/features/tutoriels/progression';
import { useScaled } from '../../src/lib/textScale';
import { useThemeColors } from '../../src/lib/theme';

// UN CHAPITRE DE TUTORIEL.
//
// LA FORME EST LA MÊME POUR TOUS, et c'est ce qui la rend lisible : objectif,
// étapes, astuce, résultat. On sait avant de lire où trouver quoi, et on peut
// sauter directement au résultat pour vérifier qu'on est au bon endroit.
//
// LES DÉMONSTRATIONS SONT POSÉES DANS LE FIL DES ÉTAPES, pas regroupées en
// haut. Une image en tête de page montre le décor ; une image collée à
// l'étape qui la décrit montre LE bouton dont on parle, au moment où on lit
// la phrase. C'est toute la différence entre illustrer et expliquer.
//
// PAS DE FIL D'ARIANE. Sur un téléphone, l'en-tête natif porte déjà le retour
// et le titre du chapitre ; une deuxième ligne « Tutoriels › Chapitre 2 »
// répéterait ce que la flèche dit mieux. Le rang (« 2 sur 10 ») reste, lui :
// il dit où l'on en est, ce que la flèche ne dit pas.

export default function TutorielScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chapitre = chapitreParId(id);
  const lus = useChapitresLus();
  const espaceBarre = useSpaceForAppTabBar();
  const [guideOuvert, setGuideOuvert] = useState(false);

  if (!chapitre) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('tutoriels.title') }} />
        <View className="flex-1 bg-sand">
          <EmptyState icon="guide" title={t('tutoriels.search_empty')} />
        </View>
      </>
    );
  }

  const titre = t(cleDe(chapitre, 'title'));
  const lu = lus.has(chapitre.id);
  const { precedent, suivant } = voisins(chapitre.id);
  const etapes = etapesDe(t, chapitre.id);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: titre }} />

      <ScrollView
        className="flex-1 bg-sand"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: espaceBarre + 24 }}
      >
        <Text className="mb-3 text-caption font-semibold uppercase tracking-wide text-ink-faint">
          {rangDe(chapitre.id)} / {CHAPITRES.length}
        </Text>

        <Demo id={chapitre.demo} />

        <Section titre={t('tutoriels.goal')} />
        <Text className="text-body leading-6 text-ink">{t(cleDe(chapitre, 'goal'))}</Text>

        <Section titre={t('tutoriels.steps')} />
        {etapes.map((etape, rang) => (
          <View key={rang} className="mb-4">
            <Etape numero={rang + 1} texte={etape} />
            {/* La démonstration de CETTE étape, quand elle en a une. */}
            {chapitre.demosEtapes?.[rang] ? (
              <View className="mt-3">
                <Demo id={chapitre.demosEtapes[rang]} />
              </View>
            ) : null}
          </View>
        ))}

        {/* ASTUCE ET RÉSULTAT SONT DES BLOCS TEINTÉS, pas des paragraphes de
            plus : ce sont les deux choses qu'on relit en diagonale trois
            semaines plus tard, et elles doivent se retrouver sans être lues. */}
        <Bloc tonalite="astuce" icone="star" titre={t('tutoriels.tip')} texte={t(cleDe(chapitre, 'tip'))} />
        <Bloc
          tonalite="resultat"
          icone="validate"
          titre={t('tutoriels.result')}
          texte={t(cleDe(chapitre, 'result'))}
        />

        {/* LIRE COMMENT ON RANGE EST UTILE, LE FAIRE L'EST DAVANTAGE. Le
            chapitre d'entrée rend donc la main au guide de démarrage plutôt
            que de réécrire ce qu'il sait déjà faire. */}
        {chapitre.action === 'guide' ? (
          <View className="mt-6 rounded-2xl border border-ink/10 bg-surface p-4">
            <Text className="mb-3 text-caption leading-4 text-ink-soft">{t(cleDe(chapitre, 'action_hint'))}</Text>
            <Button
              label={t(cleDe(chapitre, 'action'))}
              variant="outline"
              onPress={() => setGuideOuvert(true)}
            />
          </View>
        ) : null}

        <View className="mt-8">
          {lu ? (
            <View className="flex-row items-center justify-center gap-2 py-3">
              <IconLu />
              <Text className="text-label font-semibold text-ink-soft">{t('tutoriels.marked_read')}</Text>
            </View>
          ) : (
            <Button label={t('tutoriels.mark_read')} onPress={() => marquerLu(chapitre.id)} />
          )}
        </View>

        {/* LES DEUX VOISINS DISENT OÙ ILS MÈNENT. « Suivant » seul oblige à
            appuyer pour savoir ce qu'on va lire. */}
        <View className="mt-6 gap-2">
          {precedent ? (
            <Voisin sens="precedent" titre={t(cleDe(precedent, 'title'))} onPress={() => router.replace(`/tutoriel/${precedent.id}`)} />
          ) : null}
          {suivant ? (
            <Voisin sens="suivant" titre={t(cleDe(suivant, 'title'))} onPress={() => router.replace(`/tutoriel/${suivant.id}`)} />
          ) : null}
        </View>
      </ScrollView>

      <OnboardingGuide visible={guideOuvert} onClose={() => setGuideOuvert(false)} />
    </>
  );
}

/** Le même intertitre que les feuilles de l'app : capitale discrète et filet. */
function Section({ titre }: { titre: string }) {
  return (
    <View className="mb-3 mt-7 flex-row items-center gap-3">
      <Text className="text-caption font-semibold uppercase tracking-wide text-ink-faint">{titre}</Text>
      <View className="h-px flex-1 bg-ink/10" />
    </View>
  );
}

function Etape({ numero, texte }: { numero: number; texte: string }) {
  const pastille = useScaled(26);
  return (
    <View className="flex-row gap-3">
      <View
        style={{ width: pastille, height: pastille, borderRadius: pastille / 2 }}
        className="items-center justify-center bg-coral-light"
      >
        <Text className="text-caption font-bold text-coral-dark">{numero}</Text>
      </View>
      <Text className="flex-1 text-body leading-6 text-ink">{texte}</Text>
    </View>
  );
}

function Bloc({
  tonalite,
  icone,
  titre,
  texte,
}: {
  tonalite: 'astuce' | 'resultat';
  icone: 'star' | 'validate';
  titre: string;
  texte: string;
}) {
  const colors = useThemeColors();
  const astuce = tonalite === 'astuce';
  return (
    <View className={`mt-4 rounded-2xl p-4 ${astuce ? 'bg-mustard-light' : 'bg-teal-light'}`}>
      <View className="mb-2 flex-row items-center gap-2">
        <Icon name={icone} size={16} color={astuce ? colors.mustardDark : colors.tealDark} />
        <Text
          className={`text-caption font-semibold uppercase tracking-wide ${
            astuce ? 'text-mustard-dark' : 'text-teal-dark'
          }`}
        >
          {titre}
        </Text>
      </View>
      <Text className="text-body leading-6 text-ink">{texte}</Text>
    </View>
  );
}

function IconLu() {
  const colors = useThemeColors();
  return <Icon name="validate" size={18} color={colors.tealDark} />;
}

function Voisin({ sens, titre, onPress }: { sens: 'precedent' | 'suivant'; titre: string; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const avant = sens === 'precedent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t(avant ? 'tutoriels.previous' : 'tutoriels.next')} : ${titre}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 py-3 active:opacity-70"
    >
      {avant ? <Icon name="back" size={18} color={colors.inkSoft} /> : null}
      <View className="flex-1">
        <Text className={`text-caption text-ink-faint ${avant ? '' : 'text-right'}`}>
          {t(avant ? 'tutoriels.previous' : 'tutoriels.next')}
        </Text>
        <Text className={`text-label font-semibold text-ink ${avant ? '' : 'text-right'}`}>{titre}</Text>
      </View>
      {avant ? null : <Icon name="chevron" size={18} color={colors.inkSoft} />}
    </Pressable>
  );
}

/**
 * Les étapes d'un chapitre, lues du tableau i18n.
 *
 * `returnObjects` est ce qui permet de garder les étapes en LISTE dans
 * fr.json et en.json, donc de les relire côte à côte et d'en ajouter une sans
 * toucher au code. Le repli sur un tableau vide plutôt qu'une exception : une
 * clé manquante doit donner un chapitre incomplet, pas un écran blanc.
 */
function etapesDe(t: TFunction, id: string): string[] {
  const valeur: unknown = t(`tutoriels.chapters.${id}.steps`, { returnObjects: true });
  return Array.isArray(valeur) ? valeur.filter((etape): etape is string => typeof etape === 'string') : [];
}
