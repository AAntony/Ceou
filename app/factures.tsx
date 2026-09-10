import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorState } from '../src/components/ErrorState';
import { usePullToRefresh } from '../src/components/usePullToRefresh';
import { dateOrderFor, fromIsoDate } from '../src/features/factures/dateField';
import { useFacturesForHabitation } from '../src/features/factures/queries';
import { useMediaSource } from '../src/lib/images/media';

// LE DOSSIER D'UN LOGEMENT : tout ce qui y est prouvé.
//
// C'est l'écran qu'on ouvre après un cambriolage, un incendie ou un dégât des
// eaux — c'est-à-dire dans les pires jours, et pressé. Deux conséquences sur
// ce qu'il montre :
//
//  - LE TOTAL EN PREMIER. C'est le chiffre qu'un assureur demande d'abord, et
//    celui que personne n'a envie de calculer à la main dans ce moment-là.
//  - CHAQUE LIGNE SE SUFFIT. Le document, ce qu'il a coûté, quand, chez qui,
//    et ce qu'il couvre. On doit pouvoir lire la liste sans ouvrir une seule
//    facture.
//
// Il n'y a pas de bouton « ajouter » ici, et c'est voulu : une facture
// s'attache depuis la fiche de l'objet qu'elle prouve. Cet écran-ci relit.

type FactureEntry = ReturnType<typeof useFacturesForHabitation>['data'] extends (infer T)[] | undefined ? T : never;

export default function FacturesScreen() {
  const { t, i18n } = useTranslation();
  const { habitationId } = useLocalSearchParams<{ habitationId: string }>();
  const { data, isLoading, isError, refetch } = useFacturesForHabitation(habitationId);
  const refreshControl = usePullToRefresh();

  const factures = data ?? [];

  // LE TOTAL NE COMPTE QUE CE QUI EST CHIFFRÉ, et il faut le dire à l'écran.
  // Le montant étant facultatif, un total muet laisserait croire que c'est la
  // valeur de tout le logement — alors qu'il ignore les factures sans
  // montant. Mieux vaut annoncer sur combien il porte.
  const chiffrees = factures.filter((f) => f.amount != null);
  const total = chiffrees.reduce((somme, f) => somme + Number(f.amount), 0);

  return (
    <>
      <Stack.Screen options={{ title: t('factures.list.title') }} />
      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-sand">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : factures.length === 0 ? (
        <EmptyState icon="facture" title={t('factures.list.empty_title')} subtitle={t('factures.list.empty_hint')} />
      ) : (
        <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 py-4" refreshControl={refreshControl}>
          {chiffrees.length > 0 ? (
            <View className="mb-4 rounded-2xl border border-ink/10 bg-surface px-4 py-3">
              <Text className="text-caption text-ink-soft">
                {t('factures.list.total_on', { count: chiffrees.length, sur: factures.length })}
              </Text>
              <Text className="text-title font-bold text-ink">{formatMontant(total, i18n.language)}</Text>
            </View>
          ) : null}

          {factures.map((facture) => (
            <FactureCard key={facture.id} facture={facture} />
          ))}
        </ScrollView>
      )}
    </>
  );
}

function FactureCard({ facture }: { facture: FactureEntry }) {
  const { t, i18n } = useTranslation();
  const document = useMediaSource(facture.document_url);
  const order = dateOrderFor(i18n.language);

  const date = fromIsoDate(facture.purchase_date, order);
  const garantieFinie = facture.warranty_until ? new Date(facture.warranty_until) < new Date() : null;

  return (
    <View className="mb-3 flex-row gap-3 rounded-2xl border border-ink/10 bg-surface p-3">
      <View className="h-20 w-16 overflow-hidden rounded-lg bg-sand">
        {/* `contain` : on doit reconnaitre le document, pas l'habiller. */}
        {document ? <Image source={document} style={{ width: '100%', height: '100%' }} contentFit="contain" /> : null}
      </View>

      <View className="flex-1">
        <Text numberOfLines={1} className="text-body font-semibold text-ink">
          {facture.vendor || date || t('factures.block.untitled')}
        </Text>

        {facture.amount != null ? (
          <Text className="text-body text-ink">{formatMontant(Number(facture.amount), i18n.language)}</Text>
        ) : null}

        {facture.vendor && date ? <Text className="text-caption text-ink-soft">{date}</Text> : null}

        {/* CE QUE LA FACTURE COUVRE, nommé et pas seulement compté : c'est ce
            qu'un assureur lit, et c'est aussi ce qui permet de repérer d'un
            coup d'oeil qu'un objet manque au dossier. */}
        <Text numberOfLines={2} className="mt-1 text-caption text-ink-soft">
          {facture.objet_names.join(', ')}
        </Text>

        {garantieFinie !== null ? (
          <Text
            className={garantieFinie ? 'mt-1 text-caption text-ink-soft' : 'mt-1 text-caption font-semibold text-teal-dark'}
          >
            {garantieFinie
              ? t('factures.block.warranty_over')
              : t('factures.list.warranty_until', { date: fromIsoDate(facture.warranty_until, order) })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function formatMontant(montant: number, langue: string): string {
  return new Intl.NumberFormat(langue, { style: 'currency', currency: 'EUR' }).format(montant);
}
