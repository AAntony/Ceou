import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorState } from '../src/components/ErrorState';
import { Icon } from '../src/components/Icon';
import { IconBadge } from '../src/components/IconBadge';
import { SegmentedTabs } from '../src/components/SegmentedTabs';
import { usePullToRefresh } from '../src/components/usePullToRefresh';
import { isOverdue, useClosePret, usePrets, type PretEntry } from '../src/features/loans/queries';
import { syncLoanReminders } from '../src/features/notifications/loanReminders';
import { useThemeColors } from '../src/lib/theme';

// L'écran « Prêts » : ce qui est sorti de chez soi, et ce qu'on doit rendre.
//
// UNE SEULE LISTE POUR LES DEUX SENS, et non deux onglets. On ne se demande
// pas « qu'est-ce que j'ai prêté » puis « qu'est-ce que j'ai emprunté » : on
// se demande « qu'est-ce qui traîne ». Le sens est une étiquette sur la
// ligne, pas une navigation.
//
// LE TRI VIENT DU SERVEUR (list_objet_prets) : échéances les plus proches en
// tête, donc les retards d'abord, et les prêts sans date de retour à la fin —
// ils ne sont jamais urgents.

function PretRow({ entry, onReturn, returning }: { entry: PretEntry; onReturn: () => void; returning: boolean }) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const overdue = isOverdue(entry);
  const closed = entry.returnedAt !== null;
  const date = entry.dueAt ? new Date(entry.dueAt).toLocaleDateString(i18n.language) : '';

  return (
    <View
      className={`mb-3 rounded-2xl border bg-surface p-4 ${
        overdue ? 'border-red-500/40' : 'border-ink/10'
      } ${closed ? 'opacity-60' : ''}`}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/objet/${entry.objetId}`)}
        className="flex-row items-center gap-3 active:opacity-70"
      >
        <IconBadge icon="objet" fill={colors.sandDark} photoUri={entry.objetPhotoUrl} size={44} />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-body font-semibold text-ink">
            {entry.objetName}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-label text-ink-soft">
            {entry.direction === 'pret'
              ? t('loans.banner.lent_to', { name: entry.counterpartLabel })
              : t('loans.banner.borrowed_from', { name: entry.counterpartLabel })}
          </Text>
        </View>
        <Icon name="chevron" size={20} color={colors.inkFaint} />
      </Pressable>

      <Text className={`mt-2 text-caption ${overdue ? 'font-semibold text-danger' : 'text-ink-soft'}`}>
        {closed
          ? t('loans.row.returned_on', {
              date: new Date(entry.returnedAt as string).toLocaleDateString(i18n.language),
            })
          : entry.dueAt === null
            ? t('loans.banner.no_due')
            : overdue
              ? t('loans.banner.overdue', { date })
              : t('loans.banner.due_on', { date })}
      </Text>

      {entry.note ? <Text className="mt-1 text-caption italic text-ink-soft">{entry.note}</Text> : null}

      {closed ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={onReturn}
          disabled={returning}
          className={`mt-3 flex-row items-center gap-1.5 self-start rounded-full border border-ink/10 px-3 py-2 active:opacity-70 ${
            returning ? 'opacity-50' : ''
          }`}
        >
          <Icon name="included" size={16} color={colors.inkSoft} />
          <Text className="text-label font-medium text-ink-soft">
            {entry.direction === 'pret' ? t('loans.banner.mark_returned') : t('loans.banner.mark_given_back')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function PretsScreen() {
  const { t } = useTranslation();
  const refreshControl = usePullToRefresh();
  const [showClosed, setShowClosed] = useState(false);
  const { data, isLoading, isError, refetch } = usePrets(showClosed);
  const closePret = useClosePret();

  // Remet les rappels de l'appareil en phase avec la réalité : un prêt peut
  // avoir été rendu depuis un autre téléphone, ou l'app réinstallée — ce qui
  // efface tout ce qui était programmé. Volontairement sur la liste OUVERTE
  // seulement : l'onglet Historique n'a aucun rappel à poser.
  useEffect(() => {
    if (!data || showClosed) return;
    void syncLoanReminders(data, t);
  }, [data, showClosed, t]);

  // L'historique arrive dans la même requête que les prêts en cours (le
  // serveur ne filtre que sur `returned_at`) : l'onglet « Historique » ne
  // garde donc que les lignes rendues, sinon il répéterait la première liste.
  const entries = (data ?? []).filter((entry) => (showClosed ? entry.returnedAt !== null : true));

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('loans.title') }} />
      {isError ? (
        <View className="flex-1 bg-sand">
          <ErrorState onRetry={() => refetch()} />
        </View>
      ) : (
        <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pb-24 pt-4" refreshControl={refreshControl}>
          <Text className="mb-4 text-label leading-5 text-ink-soft">{t('loans.intro')}</Text>

          <SegmentedTabs
            value={showClosed ? 'closed' : 'open'}
            onChange={(next: 'open' | 'closed') => setShowClosed(next === 'closed')}
            options={[
              { value: 'open' as const, label: t('loans.tab_open') },
              { value: 'closed' as const, label: t('loans.tab_history') },
            ]}
          />

          {isLoading ? (
            <View className="mt-10 items-center">
              <ActivityIndicator />
            </View>
          ) : entries.length === 0 ? (
            <EmptyState
              icon="pret"
              title={showClosed ? t('loans.empty_history') : t('loans.empty_open')}
              subtitle={showClosed ? undefined : t('loans.empty_open_hint')}
            />
          ) : (
            entries.map((entry) => (
              <PretRow
                key={entry.id}
                entry={entry}
                onReturn={() => closePret.mutate(entry.id)}
                returning={closePret.isPending && closePret.variables === entry.id}
              />
            ))
          )}
        </ScrollView>
      )}
    </>
  );
}
