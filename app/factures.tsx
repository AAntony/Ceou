import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorState } from '../src/components/ErrorState';
import { Icon } from '../src/components/Icon';
import { PhotoViewerModal } from '../src/components/PhotoViewerModal';
import { usePullToRefresh } from '../src/components/usePullToRefresh';
import { dateOrderFor, fromIsoDate } from '../src/features/factures/dateField';
import { useFacturesForHabitation } from '../src/features/factures/queries';
import { useMediaSource } from '../src/lib/images/media';
import { useScaled } from '../src/lib/textScale';
import { useThemeColors } from '../src/lib/theme';

// LE DOSSIER D'UN LOGEMENT : tout ce qui y est prouvé.
//
// C'est l'écran qu'on ouvre après un cambriolage, un incendie ou un dégât des
// eaux — donc pressé, et dans un mauvais jour. Trois choix en découlent :
//
//  - LE TOTAL EN PREMIER, parce que c'est le chiffre demandé d'abord et que
//    personne n'a envie de le calculer à la main ce jour-là.
//  - TOUTES LES CARTES ONT LA MÊME HAUTEUR. Elle ne vient pas d'un nombre de
//    pixels — qui se romprait au premier agrandissement du texte — mais du
//    fait que chaque carte rend TOUJOURS le même nombre de lignes, remplies
//    ou non. Une liste dont les cartes sautent selon ce qui est renseigné se
//    parcourt mal et se compare encore plus mal.
//  - LES MONTANTS S'ALIGNENT, en chiffres à chasse fixe. C'est ce qui permet
//    de lire une colonne de sommes plutôt qu'une suite de nombres.
//
// Pas de bouton « ajouter » ici : une facture s'attache depuis la fiche de
// l'objet qu'elle prouve. Cet écran-ci relit.

type FactureEntry = NonNullable<ReturnType<typeof useFacturesForHabitation>['data']>[number];

export default function FacturesScreen() {
  const { t, i18n } = useTranslation();
  const { habitationId } = useLocalSearchParams<{ habitationId: string }>();
  const { data, isLoading, isError, refetch } = useFacturesForHabitation(habitationId);
  const refreshControl = usePullToRefresh();
  const [apercu, setApercu] = useState<string | null>(null);

  const factures = data ?? [];
  const chiffrees = factures.filter((f) => f.amount != null);
  const total = chiffrees.reduce((somme, f) => somme + Number(f.amount), 0);

  return (
    <>
      {/* `headerShown` EXPLICITE : le Stack racine les masque par défaut, et
          une destination de premier rang sans en-tête n'a plus ni titre ni
          retour. Même réabonnement que l'écran des prêts. */}
      <Stack.Screen options={{ headerShown: true, title: t('factures.list.title') }} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-sand">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View className="flex-1 bg-sand">
          <ErrorState onRetry={() => refetch()} />
        </View>
      ) : factures.length === 0 ? (
        <View className="flex-1 bg-sand">
          <EmptyState icon="facture" title={t('factures.list.empty_title')} subtitle={t('factures.list.empty_hint')} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-sand"
          contentContainerClassName="px-6 pb-10 pt-4"
          refreshControl={refreshControl}
        >
          <Text className="mb-4 text-label leading-5 text-ink-soft">{t('factures.list.intro')}</Text>

          <TotalCard total={total} chiffrees={chiffrees.length} sur={factures.length} langue={i18n.language} />

          {factures.map((facture) => (
            <FactureCard key={facture.id} facture={facture} onOpen={() => setApercu(facture.document_url)} />
          ))}
        </ScrollView>
      )}

      <PhotoViewerModal visible={apercu !== null} uri={apercu} onClose={() => setApercu(null)} />
    </>
  );
}

/**
 * Ce que le dossier vaut, annoncé d'entrée.
 *
 * IL DIT SUR QUOI IL PORTE, et ce n'est pas un scrupule inutile : le montant
 * étant facultatif, un total muet laisserait croire qu'il couvre tout le
 * logement alors qu'il ignore les factures sans montant. Quelqu'un qui
 * recopie ce chiffre dans une déclaration doit savoir ce qu'il recopie.
 */
function TotalCard({
  total,
  chiffrees,
  sur,
  langue,
}: {
  total: number;
  chiffrees: number;
  sur: number;
  langue: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  if (chiffrees === 0) return null;

  return (
    <View className="mb-5 rounded-2xl bg-coral-light p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="facture" size={16} color={colors.accentDark} />
        <Text className="text-caption font-semibold uppercase tracking-wider text-coral-dark">
          {t('factures.list.total_label')}
        </Text>
      </View>
      <Text
        className="mt-1 text-display font-bold text-ink"
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatMontant(total, langue)}
      </Text>
      <Text className="text-caption text-ink-soft">{t('factures.list.total_on', { count: chiffrees, sur })}</Text>
    </View>
  );
}

function FactureCard({ facture, onOpen }: { facture: FactureEntry; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const document = useMediaSource(facture.document_url);
  const order = dateOrderFor(i18n.language);

  // La vignette est dessinée en pixels et suit donc le réglage de taille :
  // sinon elle deviendrait un timbre à côté d'un texte doublé.
  const largeur = useScaled(52);
  const hauteur = useScaled(68);

  const date = fromIsoDate(facture.purchase_date, order);
  const titre = facture.vendor || date || t('factures.block.untitled');
  const garantieFinie = facture.warranty_until ? new Date(facture.warranty_until) < new Date() : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('factures.list.open_document', { name: titre })}
      onPress={onOpen}
      className="mb-3 flex-row gap-3 rounded-2xl border border-ink/10 bg-surface p-3 active:opacity-70"
    >
      {/* PROPORTION D'UN TICKET, plus haute que large : c'est ce qui la fait
          reconnaître comme un document et non comme la photo d'un objet. */}
      <View
        style={{ width: largeur, height: hauteur }}
        className="overflow-hidden rounded-lg border border-ink/10 bg-sand-dark"
      >
        {document ? (
          <Image source={document} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="facture" size={18} color={colors.inkFaint} />
          </View>
        )}
      </View>

      {/* TROIS LIGNES, TOUJOURS. C'est ce qui donne à toutes les cartes la
          même hauteur sans figer un nombre de pixels — donc une liste qui
          reste régulière même à 200 % de texte. */}
      <View className="flex-1 justify-center">
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="flex-1 text-body font-semibold text-ink">
            {titre}
          </Text>
          {garantieFinie === false ? (
            <View className="rounded-full bg-teal-light px-2 py-0.5">
              <Text className="text-caption font-semibold text-teal-dark">{t('factures.block.warranty_active')}</Text>
            </View>
          ) : null}
        </View>

        {/* LE MONTANT EST LE HÉROS de la ligne, et il garde sa place même
            absent : une ligne qui disparaîtrait ferait sauter la carte. */}
        <Text
          numberOfLines={1}
          className={facture.amount != null ? 'text-subheading font-bold text-ink' : 'text-subheading text-ink-faint'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {facture.amount != null ? formatMontant(Number(facture.amount), i18n.language) : t('factures.list.no_amount')}
        </Text>

        <Text numberOfLines={1} className="text-caption text-ink-soft">
          {[facture.vendor && date ? date : null, facture.objet_names.join(', ')].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

function formatMontant(montant: number, langue: string): string {
  return new Intl.NumberFormat(langue, { style: 'currency', currency: 'EUR' }).format(montant);
}
