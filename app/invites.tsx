import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { BottomSheetModal } from '../src/components/BottomSheetModal';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorState } from '../src/components/ErrorState';
import { Icon } from '../src/components/Icon';
import { QrCode } from '../src/components/QrCode';
import { SegmentedTabs } from '../src/components/SegmentedTabs';
import { TextField } from '../src/components/TextField';
import { usePullToRefresh } from '../src/components/usePullToRefresh';
import { syncInviteReminders } from '../src/features/notifications/inviteReminders';
import { logClientError } from '../src/lib/errorLogging';
import { STACK_SCALE, useTextScale } from '../src/lib/textScale';
import { useThemeColors } from '../src/lib/theme';
import {
  expiryInDays,
  formatInviteQrValue,
  useDeleteShareInvite,
  useMyShareInvites,
  useUpdateShareInvite,
  type ShareInviteEntry,
} from '../src/features/sharing/queries';

// « Mes codes d'invitation » : voir, renouveler, supprimer.
//
// Écran nécessaire dès lors qu'un code peut être permanent et multi-usage —
// un code éphémère à usage unique se gérait tout seul en expirant. Un hôte
// qui laisse un QR affiché dans son logement doit pouvoir savoir combien de
// monde l'a utilisé et le couper.

function isExpired(entry: ShareInviteEntry): boolean {
  return entry.expiresAt !== null && new Date(entry.expiresAt).getTime() <= Date.now();
}

function isExhausted(entry: ShareInviteEntry): boolean {
  return entry.maxUses !== null && entry.useCount >= entry.maxUses;
}

function InviteCard({
  entry,
  onShowQr,
  onRenew,
  onDelete,
}: {
  entry: ShareInviteEntry;
  onShowQr: () => void;
  onRenew: () => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const expired = isExpired(entry);
  const exhausted = isExhausted(entry);
  // Épuisé n'est PAS mort : les visiteurs déjà entrés gardent leur accès,
  // seul un nouveau venu est refusé. Expiré, lui, coupe tout le monde — d'où
  // deux libellés distincts plutôt qu'un seul état « inactif ».
  const dead = expired;

  return (
    <View className={`mb-3 rounded-2xl border bg-surface p-4 ${dead ? 'border-ink/10 opacity-60' : 'border-ink/10'}`}>
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-body font-bold text-ink">
            {entry.label ??
              (entry.habitationNames.length > 0 ? entry.habitationNames.join(', ') : t('invites.untitled'))}
          </Text>
          {entry.label ? (
            <Text className="mt-0.5 text-caption text-ink-soft">{entry.habitationNames.join(', ')}</Text>
          ) : null}
        </View>
        <View className={`rounded-full px-2.5 py-1 ${entry.targetType === 'guest' ? 'bg-coral-light' : 'bg-sand-dark'}`}>
          <Text className={`text-caption font-semibold ${entry.targetType === 'guest' ? 'text-coral-dark' : 'text-ink-soft'}`}>
            {t(entry.targetType === 'guest' ? 'invites.badge_guest' : 'invites.badge_friend')}
          </Text>
        </View>
      </View>

      <Text className="mb-2 text-subheading font-bold tracking-widest text-ink">{entry.code}</Text>

      <View className="mb-3 gap-1">
        <Text className="text-caption text-ink-soft">
          {entry.maxUses === null
            ? t('invites.uses_unlimited', { used: entry.useCount })
            : t('invites.uses_limited', { used: entry.useCount, max: entry.maxUses })}
          {exhausted && !expired ? ` — ${t('invites.exhausted')}` : ''}
        </Text>
        <Text className={`text-caption ${expired ? 'font-semibold text-danger' : 'text-ink-soft'}`}>
          {entry.expiresAt === null
            ? t('invites.never_expires')
            : expired
              ? t('invites.expired')
              : t('invites.expires_on', {
                  date: new Date(entry.expiresAt).toLocaleDateString(i18n.language, {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Pressable
          onPress={onShowQr}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 rounded-full border border-ink/10 px-3 py-2 active:opacity-70"
        >
          <Icon name="qrcode" size={16} color={colors.inkSoft} />
          <Text className="text-label font-medium text-ink-soft">{t('invites.show_qr')}</Text>
        </Pressable>
        {entry.targetType === 'guest' ? (
          <Pressable
            onPress={onRenew}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 rounded-full border border-ink/10 px-3 py-2 active:opacity-70"
          >
            <Icon name="history" size={16} color={colors.inkSoft} />
            <Text className="text-label font-medium text-ink-soft">{t('invites.renew')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 rounded-full border border-red-500/40 px-3 py-2 active:opacity-70"
        >
          <Icon name="delete" size={16} color={colors.danger} />
          <Text className="text-label font-medium text-danger">{t('common.delete')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function InvitesScreen() {
  const colors = useThemeColors();
  const refreshControl = usePullToRefresh();
  const { t } = useTranslation();
  const { textScale } = useTextScale();
  // Deux champs numeriques cote a cote : a x1,3 « Nombre d'utilisations »
  // n'a plus qu'une demi-largeur et s'y coupe. Empiles, chaque libelle tient.
  const fieldsStacked = textScale >= STACK_SCALE;
  const { data: invites, isLoading, isError, refetch } = useMyShareInvites();
  const updateInvite = useUpdateShareInvite();
  const deleteInvite = useDeleteShareInvite();

  // Réconciliation à chaque chargement de la liste : c'est ici qu'on
  // rattrape les codes renouvelés, épuisés ou supprimés, et les rappels
  // perdus par une réinstallation.
  useEffect(() => {
    if (invites) syncInviteReminders(invites, t);
  }, [invites, t]);

  const [qrEntry, setQrEntry] = useState<ShareInviteEntry | null>(null);
  const [renewEntry, setRenewEntry] = useState<ShareInviteEntry | null>(null);
  const [renewPermanent, setRenewPermanent] = useState(false);
  const [renewMaxUses, setRenewMaxUses] = useState('1');
  const [renewDays, setRenewDays] = useState('7');
  const [renewReset, setRenewReset] = useState(true);

  const openRenew = (entry: ShareInviteEntry) => {
    setRenewPermanent(entry.maxUses === null && entry.expiresAt === null);
    setRenewMaxUses(String(entry.maxUses ?? 1));
    setRenewDays('7');
    setRenewReset(true);
    setRenewEntry(entry);
  };

  const handleRenew = async () => {
    if (!renewEntry) return;
    const maxUses = renewPermanent ? null : Math.max(1, Math.min(999, parseInt(renewMaxUses, 10) || 1));
    const days = Math.max(1, Math.min(3650, parseInt(renewDays, 10) || 1));
    try {
      await updateInvite.mutateAsync({
        inviteId: renewEntry.id,
        maxUses,
        expiresAt: renewPermanent ? null : expiryInDays(days),
        resetUses: renewReset,
        label: renewEntry.label,
        // Renouveler ne rouvre pas la question du préavis : on reconduit
        // celui déjà choisi, et le rappel se recalcule tout seul depuis la
        // nouvelle date d'expiration.
        remindDaysBefore: renewEntry.remindDaysBefore,
      });
      setRenewEntry(null);
    } catch (error) {
      logClientError(error, { source: 'renew_invite' });
      Alert.alert(t('common.error_generic'));
    }
  };

  // Confirmation obligatoire, et le texte doit dire la vraie conséquence :
  // supprimer un code coupe l'accès de ceux qui l'ont déjà utilisé. C'est le
  // modèle choisi (« l'accès suit le code ») mais ce n'est pas devinable
  // depuis un bouton « Supprimer ».
  const confirmDelete = (entry: ShareInviteEntry) => {
    Alert.alert(
      t('invites.delete_title'),
      entry.useCount > 0
        ? t('invites.delete_body_used', { used: entry.useCount })
        : t('invites.delete_body_unused'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvite.mutateAsync(entry.id);
            } catch (error) {
              logClientError(error, { source: 'delete_invite' });
              Alert.alert(t('common.error_generic'));
            }
          },
        },
      ],
    );
  };

  const shareEntry = async (entry: ShareInviteEntry) => {
    try {
      await Share.share({
        message:
          entry.targetType === 'guest'
            ? t('friends.share.share_message_guest', { url: formatInviteQrValue(entry.code), code: entry.code })
            : t('friends.share.share_message', { code: entry.code }),
      });
    } catch {
      // Feuille de partage refermée par l'utilisateur — rien à faire.
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('invites.title') }} />
      {isError ? (
        <View className="flex-1 bg-sand">
          <ErrorState onRetry={() => refetch()} />
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center bg-sand">
          <ActivityIndicator />
        </View>
      ) : (invites ?? []).length === 0 ? (
        <View className="flex-1 bg-sand">
          <EmptyState icon="qrcode" title={t('invites.empty_title')} subtitle={t('invites.empty_subtitle')} />
        </View>
      ) : (
        <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-5 pb-32 pt-5" refreshControl={refreshControl}>
          <Text className="mb-4 text-label leading-5 text-ink-soft">{t('invites.intro')}</Text>
          {(invites ?? []).map((entry) => (
            <InviteCard
              key={entry.id}
              entry={entry}
              onShowQr={() => setQrEntry(entry)}
              onRenew={() => openRenew(entry)}
              onDelete={() => confirmDelete(entry)}
            />
          ))}
        </ScrollView>
      )}

      {/* `scrollable` : le QR mesure 200 points et ne rétrécit pas, le reste
          grandit avec le réglage de taille — sans borne, la feuille finissait
          par sortir de l'écran par le haut. */}
      <BottomSheetModal
        visible={qrEntry !== null}
        onClose={() => setQrEntry(null)}
        sheetClassName="rounded-t-3xl bg-surface px-6 pb-4 pt-6"
        scrollable
      >
        {qrEntry ? (
          <View className="items-center">
            <Text className="mb-4 text-heading font-bold text-ink">{qrEntry.label ?? t('invites.title')}</Text>
            <QrCode value={formatInviteQrValue(qrEntry.code)} size={200} />
            <Text className="mt-4 text-subheading font-bold tracking-widest text-ink">{qrEntry.code}</Text>
            <View className="mt-6 w-full gap-3">
              <Button label={t('friends.share.share_button')} onPress={() => shareEntry(qrEntry)} />
              <Button label={t('common.close')} variant="ghost" onPress={() => setQrEntry(null)} />
            </View>
          </View>
        ) : null}
      </BottomSheetModal>

      <BottomSheetModal
        visible={renewEntry !== null}
        onClose={() => setRenewEntry(null)}
        sheetClassName="rounded-t-3xl bg-surface px-6 pb-4 pt-6"
        scrollable
      >
        <Text className="mb-1 text-heading font-bold text-ink">{t('invites.renew_title')}</Text>
        <Text className="mb-4 text-label leading-5 text-ink-soft">{t('invites.renew_body')}</Text>

        <SegmentedTabs
          value={renewPermanent ? 'permanent' : 'limited'}
          onChange={(next: 'limited' | 'permanent') => setRenewPermanent(next === 'permanent')}
          options={[
            { value: 'limited' as const, label: t('friends.share.validity_limited') },
            { value: 'permanent' as const, label: t('friends.share.validity_permanent') },
          ]}
        />

        {renewPermanent ? null : (
          <View className={fieldsStacked ? '' : 'flex-row gap-3'}>
            <View className={fieldsStacked ? '' : 'flex-1'}>
              <TextField
                label={t('friends.share.max_uses')}
                value={renewMaxUses}
                onChangeText={setRenewMaxUses}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View className={fieldsStacked ? '' : 'flex-1'}>
              <TextField
                label={t('friends.share.duration_days')}
                value={renewDays}
                onChangeText={setRenewDays}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
        )}

        <Pressable
          onPress={() => setRenewReset((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: renewReset }}
          className="mb-4 flex-row items-center gap-2 py-1"
        >
          <Icon name={renewReset ? 'included' : 'excluded'} size={20} color={renewReset ? '#4CAF50' : colors.inkFaint} />
          <Text className="flex-1 text-label text-ink-soft">{t('invites.reset_uses')}</Text>
        </Pressable>

        <View className="gap-3">
          <Button label={t('invites.renew')} onPress={handleRenew} loading={updateInvite.isPending} />
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setRenewEntry(null)} />
        </View>
      </BottomSheetModal>
    </>
  );
}
