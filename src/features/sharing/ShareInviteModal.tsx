import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { QrCode } from '../../components/QrCode';
import { TextField } from '../../components/TextField';
import { logClientError } from '../../lib/errorLogging';
import type { HabitationPermission, ShareInvite } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { useHabitations } from '../inventory/queries';
import { defaultReminderDays, scheduleInviteReminder } from '../notifications/inviteReminders';
import { PermissionPicker } from './PermissionPicker';
import { expiryInDays, formatInviteQrValue, useCreateShareInvite } from './queries';
import { useThemeColors } from '../../lib/theme';

type ShareInviteModalProps = {
  visible: boolean;
  onClose: () => void;
};

type Step = 'configure' | 'result';
type TargetType = 'friend' | 'guest';

// "Partager mon code" (Profil) : choisir Habitation(s) + droit AVANT de
// générer le code — l'offre est figée au moment de la génération (voir
// share_invites/create_share_invite), pas négociée après coup par le
// destinataire.
export function ShareInviteModal({ visible, onClose }: ShareInviteModalProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: habitations } = useHabitations();
  const createInvite = useCreateShareInvite();

  const [step, setStep] = useState<Step>('configure');
  const [targetType, setTargetType] = useState<TargetType>('friend');
  const [selectedHabitationIds, setSelectedHabitationIds] = useState<string[]>([]);
  const [permission, setPermission] = useState<HabitationPermission>('consultation');
  const [resultInvite, setResultInvite] = useState<ShareInvite | null>(null);

  // Options propres au mode invité. Un code permanent est illimité en usages
  // ET sans expiration : les deux réglages disparaissent ensemble, plutôt que
  // de laisser cocher « permanent » puis saisir une durée contradictoire.
  const [guestPermanent, setGuestPermanent] = useState(false);
  const [guestMaxUses, setGuestMaxUses] = useState('1');
  const [guestDays, setGuestDays] = useState('7');
  const [guestLabel, setGuestLabel] = useState('');
  // Le champ de rappel suit la durée tant que personne n'y a touché, et se
  // fige dès la première frappe. Un simple booléen plutôt qu'un effet : la
  // valeur affichée se calcule au rendu, il n'y a aucun état à synchroniser.
  const [guestRemindDays, setGuestRemindDays] = useState('');
  const [remindTouched, setRemindTouched] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('configure');
      setTargetType('friend');
      setSelectedHabitationIds([]);
      setPermission('consultation');
      setResultInvite(null);
      setGuestPermanent(false);
      setGuestMaxUses('1');
      setGuestDays('7');
      setGuestLabel('');
      setGuestRemindDays('');
      setRemindTouched(false);
    }
  }, [visible]);

  // Saisie libre : on ne fait jamais confiance au texte tapé. Le serveur
  // revalide de son côté (invalid_max_uses / invalid_expiry), ces bornes
  // servent à ne pas lui envoyer d'emblée quelque chose d'absurde.
  const parsedMaxUses = Math.max(1, Math.min(999, parseInt(guestMaxUses, 10) || 1));
  const parsedDays = Math.max(1, Math.min(3650, parseInt(guestDays, 10) || 1));
  const remindValue = remindTouched ? guestRemindDays : String(defaultReminderDays(parsedDays));
  const parsedRemindDays = Math.max(1, Math.min(3650, parseInt(remindValue, 10) || 1));

  const myHabitations = (habitations ?? []).filter((h) => h.user_id === session?.user.id);

  const toggleHabitation = (id: string) => {
    setSelectedHabitationIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const handleGenerate = async () => {
    if (selectedHabitationIds.length === 0) return;
    try {
      // Un invité n'a jamais que la consultation, quel que soit le sélecteur
      // affiché (masqué pour ce mode, voir le rendu) — le droit "invité" en
      // texte libre côté formulaire n'existe volontairement pas.
      const isGuest = targetType === 'guest';
      const invite = await createInvite.mutateAsync({
        habitationIds: selectedHabitationIds,
        permission: isGuest ? 'consultation' : permission,
        targetType,
        // Une invitation d'ami reste à usage unique et à durée courte : le
        // serveur force ces valeurs de son côté, on lui envoie simplement des
        // valeurs cohérentes plutôt que celles du formulaire invité.
        maxUses: isGuest ? (guestPermanent ? null : parsedMaxUses) : 1,
        expiresAt: isGuest && guestPermanent ? null : expiryInDays(isGuest ? parsedDays : 7),
        label: isGuest ? guestLabel.trim() || null : null,
        // Un code d'ami dure toujours 7 jours sans réglage exposé : le
        // serveur lui impose un rappel à la veille, on ne lui envoie rien.
        remindDaysBefore: isGuest && !guestPermanent ? parsedRemindDays : null,
      });
      setResultInvite(invite);
      setStep('result');

      // Posé ici et pas seulement dans l'écran « Mes codes » : rien n'oblige
      // à passer par cet écran après avoir généré un code depuis le Profil.
      scheduleInviteReminder(
        {
          id: invite.id,
          code: invite.code,
          label: invite.label,
          habitationNames: myHabitations.filter((h) => selectedHabitationIds.includes(h.id)).map((h) => h.name),
          maxUses: invite.max_uses,
          useCount: invite.use_count,
          expiresAt: invite.expires_at,
          remindDaysBefore: invite.remind_days_before,
        },
        t,
      );
    } catch (err) {
      logClientError(err, { source: 'share_invite', targetType, habitationCount: selectedHabitationIds.length });
      Alert.alert(t('common.error_generic'));
    }
  };

  const handleShare = async () => {
    if (!resultInvite) return;
    try {
      // Un invité n'a pas l'app : lui envoyer un code sec ne lui dit ni où
      // le saisir ni quoi installer. Le lien web porte les deux.
      await Share.share({
        message:
          resultInvite.target_type === 'guest'
            ? t('friends.share.share_message_guest', {
                url: formatInviteQrValue(resultInvite.code),
                code: resultInvite.code,
              })
            : t('friends.share.share_message', { code: resultInvite.code }),
      });
    } catch {
      // L'utilisateur a simplement fermé la feuille de partage — rien à faire.
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-surface px-6 pt-6"
      sheetStyle={{ maxHeight: '85%' }}
    >
      {step === 'configure' ? (
        // `flexShrink: 1` (et pas `flex: 1`) pour la même raison que dans
        // FriendDetailSheet, où les deux erreurs ont été commises tour à
        // tour : sans lui, ce ScrollView refuse de rétrécir sous la taille
        // de son contenu et la liste d'Habitations finit tronquée par le
        // maxHeight de la feuille au lieu de défiler — invisible tant qu'on
        // a peu d'Habitations, bloquant dès qu'on en a beaucoup.
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          <Text className="mb-4 text-xl font-bold text-ink">{t('friends.share.title')}</Text>

          <Text className="mb-2 text-sm font-medium text-ink-soft">{t('friends.share.target_type')}</Text>
          <View className="mb-4 flex-row gap-2">
            <Pressable
              onPress={() => setTargetType('friend')}
              className={`flex-1 items-center rounded-xl border px-4 py-3 ${targetType === 'friend' ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
            >
              <Text className={targetType === 'friend' ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
                {t('friends.share.target_friend')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTargetType('guest')}
              className={`flex-1 items-center rounded-xl border px-4 py-3 ${targetType === 'guest' ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
            >
              <Text className={targetType === 'guest' ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
                {t('friends.share.target_guest')}
              </Text>
            </Pressable>
          </View>

          <Text className="mb-2 text-sm font-medium text-ink-soft">{t('friends.share.choose_habitations')}</Text>
          {myHabitations.length === 0 ? (
            <Text className="mb-4 text-sm text-ink-soft">{t('friends.detail.no_habitations')}</Text>
          ) : (
            myHabitations.map((h) => {
              const selected = selectedHabitationIds.includes(h.id);
              return (
                <Pressable
                  key={h.id}
                  onPress={() => toggleHabitation(h.id)}
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-ink/10 px-4 py-2.5"
                >
                  <Text className="text-sm text-ink">{h.name}</Text>
                  <Icon name={selected ? 'included' : 'excluded'} size={20} color={selected ? '#4CAF50' : colors.inkFaint} />
                </Pressable>
              );
            })
          )}

          {targetType === 'friend' ? (
            <>
              <Text className="mb-2 mt-2 text-sm font-medium text-ink-soft">{t('friends.share.permission')}</Text>
              <PermissionPicker value={permission} onChange={(p) => p && setPermission(p)} />
            </>
          ) : (
            <>
              <Text className="mt-2 text-xs text-ink-soft">{t('friends.share.guest_permission_note')}</Text>

              <Text className="mb-2 mt-4 text-sm font-medium text-ink-soft">{t('friends.share.validity')}</Text>
              <View className="mb-3 flex-row gap-2">
                <Pressable
                  onPress={() => setGuestPermanent(false)}
                  className={`flex-1 items-center rounded-xl border px-4 py-3 ${!guestPermanent ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
                >
                  <Text className={!guestPermanent ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
                    {t('friends.share.validity_limited')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setGuestPermanent(true)}
                  className={`flex-1 items-center rounded-xl border px-4 py-3 ${guestPermanent ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
                >
                  <Text className={guestPermanent ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
                    {t('friends.share.validity_permanent')}
                  </Text>
                </Pressable>
              </View>

              {guestPermanent ? (
                <Text className="mb-1 text-xs leading-4 text-ink-soft">{t('friends.share.permanent_note')}</Text>
              ) : (
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <TextField
                      label={t('friends.share.max_uses')}
                      value={guestMaxUses}
                      onChangeText={setGuestMaxUses}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                  <View className="flex-1">
                    <TextField
                      label={t('friends.share.duration_days')}
                      value={guestDays}
                      onChangeText={setGuestDays}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>
              )}

              {/* Le préavis vit avec le code, et pas dans un réglage global :
                  il n'existe pas de bonne valeur unique entre un code de 2
                  jours et un code d'un an. Pré-rempli proportionnellement
                  pour que ceux que ça n'intéresse pas passent à travers. */}
              {guestPermanent ? null : (
                <>
                  <TextField
                    label={t('friends.share.remind_days')}
                    value={remindValue}
                    onChangeText={(value) => {
                      setRemindTouched(true);
                      setGuestRemindDays(value);
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Text className="mb-3 -mt-2 text-xs leading-4 text-ink-soft">{t('friends.share.remind_hint')}</Text>
                </>
              )}

              {/* Sert uniquement au propriétaire, dans l'écran de gestion :
                  plusieurs codes sur la même Habitation sont indiscernables
                  sans un nom (« Locataires juillet », « Voisins »). */}
              <TextField
                label={t('friends.share.label_optional')}
                value={guestLabel}
                onChangeText={setGuestLabel}
                placeholder={t('friends.share.label_placeholder')}
                maxLength={40}
              />
            </>
          )}

          <View className="mt-5 mb-2">
            <Button
              label={t('friends.share.generate')}
              onPress={handleGenerate}
              loading={createInvite.isPending}
              disabled={selectedHabitationIds.length === 0}
            />
          </View>
        </ScrollView>
      ) : resultInvite ? (
        <View className="items-center pb-6">
          <Text className="mb-4 text-xl font-bold text-ink">{t('friends.share.result_title')}</Text>
          <QrCode value={formatInviteQrValue(resultInvite.code)} size={200} />
          <Text className="mt-4 text-lg font-bold tracking-widest text-ink">{resultInvite.code}</Text>
          <Text className="mt-1 text-center text-xs text-ink-soft">{t('friends.share.expires_hint')}</Text>
          <View className="mt-6 w-full gap-3">
            <Button label={t('friends.share.share_button')} onPress={handleShare} />
            <Button label={t('common.close')} variant="ghost" onPress={onClose} />
          </View>
        </View>
      ) : null}
    </BottomSheetModal>
  );
}
