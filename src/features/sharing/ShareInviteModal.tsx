import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { QrCode } from '../../components/QrCode';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { TextField } from '../../components/TextField';
import { logClientError } from '../../lib/errorLogging';
import { STACK_SCALE, useTextScale } from '../../lib/textScale';
import type { ShareInvite } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { useHabitations } from '../inventory/queries';
import { defaultReminderDays, scheduleInviteReminder } from '../notifications/inviteReminders';
import { expiryInDays, formatInviteQrValue, useCreateShareInvite } from './queries';
import { useThemeColors } from '../../lib/theme';

type ShareInviteModalProps = {
  visible: boolean;
  onClose: () => void;
};

type Step = 'configure' | 'result';

// « Inviter un invité » (Profil) : un code d'accès sans compte, façon
// location — choisir Habitation(s) et durée AVANT de générer, l'offre étant
// figée au moment de la génération (voir share_invites/create_share_invite),
// pas négociée après coup par le destinataire.
//
// CET ÉCRAN NE FABRIQUE PLUS DE CODE D'AMI. Il en proposait un, qui n'était
// pas le friend_code permanent du Profil : tapé à la main, il ne menait nulle
// part (voir la migration 20260826100000). Devenir ami passe désormais
// uniquement par le code ami, et les droits se règlent après acceptation,
// depuis la fiche de l'ami.
export function ShareInviteModal({ visible, onClose }: ShareInviteModalProps) {
  const colors = useThemeColors();
  const { textScale } = useTextScale();
  const fieldsStacked = textScale >= STACK_SCALE;
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const { data: habitations } = useHabitations();
  const createInvite = useCreateShareInvite();

  const [step, setStep] = useState<Step>('configure');
  const [selectedHabitationIds, setSelectedHabitationIds] = useState<string[]>([]);
  const [resultInvite, setResultInvite] = useState<ShareInvite | null>(null);

  // Un code permanent est illimité en usages ET sans expiration : les deux
  // réglages disparaissent ensemble, plutôt que de laisser cocher
  // « permanent » puis saisir une durée contradictoire.
  const [permanent, setPermanent] = useState(false);
  const [maxUses, setMaxUses] = useState('1');
  const [days, setDays] = useState('7');
  const [label, setLabel] = useState('');
  // Le champ de rappel suit la durée tant que personne n'y a touché, et se
  // fige dès la première frappe. Un simple booléen plutôt qu'un effet : la
  // valeur affichée se calcule au rendu, il n'y a aucun état à synchroniser.
  const [remindDays, setRemindDays] = useState('');
  const [remindTouched, setRemindTouched] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('configure');
      setSelectedHabitationIds([]);
      setResultInvite(null);
      setPermanent(false);
      setMaxUses('1');
      setDays('7');
      setLabel('');
      setRemindDays('');
      setRemindTouched(false);
    }
  }, [visible]);

  // Saisie libre : on ne fait jamais confiance au texte tapé. Le serveur
  // revalide de son côté (invalid_max_uses / invalid_expiry), ces bornes
  // servent à ne pas lui envoyer d'emblée quelque chose d'absurde.
  const parsedMaxUses = Math.max(1, Math.min(999, parseInt(maxUses, 10) || 1));
  const parsedDays = Math.max(1, Math.min(3650, parseInt(days, 10) || 1));
  const remindValue = remindTouched ? remindDays : String(defaultReminderDays(parsedDays));
  const parsedRemindDays = Math.max(1, Math.min(3650, parseInt(remindValue, 10) || 1));

  const myHabitations = (habitations ?? []).filter((h) => h.user_id === session?.user.id);

  const toggleHabitation = (id: string) => {
    setSelectedHabitationIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const handleGenerate = async () => {
    if (selectedHabitationIds.length === 0) return;
    try {
      const invite = await createInvite.mutateAsync({
        habitationIds: selectedHabitationIds,
        // Le serveur force la même valeur : un invité consulte, jamais plus.
        // Le sélecteur de droit n'existe volontairement pas ici.
        permission: 'consultation',
        maxUses: permanent ? null : parsedMaxUses,
        expiresAt: permanent ? null : expiryInDays(parsedDays),
        label: label.trim() || null,
        remindDaysBefore: permanent ? null : parsedRemindDays,
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
      logClientError(err, { source: 'share_invite', habitationCount: selectedHabitationIds.length });
      Alert.alert(t('common.error_generic'));
    }
  };

  const handleShare = async () => {
    if (!resultInvite) return;
    try {
      // Un invité n'a pas l'app : lui envoyer un code sec ne lui dit ni où
      // le saisir ni quoi installer. Le lien web porte les deux.
      await Share.share({
        message: t('friends.share.share_message_guest', {
          url: formatInviteQrValue(resultInvite.code),
          code: resultInvite.code,
        }),
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
          <Text className="mb-2 text-heading font-bold text-ink">{t('friends.share.title')}</Text>
          {/* Dit à quoi sert ce code, et surtout à quoi il ne sert pas :
              c'est exactement la confusion qui rendait l'ancien écran
              trompeur. */}
          <Text className="mb-5 text-label leading-5 text-ink-soft">{t('friends.share.intro')}</Text>

          <Text className="mb-2 text-label font-medium text-ink-soft">{t('friends.share.choose_habitations')}</Text>
          {myHabitations.length === 0 ? (
            <Text className="mb-4 text-label text-ink-soft">{t('friends.detail.no_habitations')}</Text>
          ) : (
            myHabitations.map((h) => {
              const selected = selectedHabitationIds.includes(h.id);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={h.id}
                  onPress={() => toggleHabitation(h.id)}
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-ink/10 px-4 py-2.5"
                >
                  <Text numberOfLines={2} className="flex-1 pr-3 text-label text-ink">
                    {h.name}
                  </Text>
                  <Icon name={selected ? 'included' : 'excluded'} size={20} color={selected ? '#4CAF50' : colors.inkFaint} />
                </Pressable>
              );
            })
          )}

          <Text className="mt-2 text-caption text-ink-soft">{t('friends.share.guest_permission_note')}</Text>

          <Text className="mb-2 mt-4 text-label font-medium text-ink-soft">{t('friends.share.validity')}</Text>
          <SegmentedTabs
            value={permanent ? 'permanent' : 'limited'}
            onChange={(next: 'limited' | 'permanent') => setPermanent(next === 'permanent')}
            options={[
              { value: 'limited' as const, label: t('friends.share.validity_limited') },
              { value: 'permanent' as const, label: t('friends.share.validity_permanent') },
            ]}
          />

          {permanent ? (
            <Text className="mb-1 text-caption leading-4 text-ink-soft">{t('friends.share.permanent_note')}</Text>
          ) : (
            /* Deux champs cote a cote, chacun avec son libelle : a x1,3
               « Nombre d'utilisations » n'a plus qu'une demi-largeur et
               s'y coupe. Empiles, chaque libelle tient sur une ligne. */
            <View className={fieldsStacked ? '' : 'flex-row gap-3'}>
              <View className={fieldsStacked ? '' : 'flex-1'}>
                <TextField
                  label={t('friends.share.max_uses')}
                  value={maxUses}
                  onChangeText={setMaxUses}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View className={fieldsStacked ? '' : 'flex-1'}>
                <TextField
                  label={t('friends.share.duration_days')}
                  value={days}
                  onChangeText={setDays}
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
          {permanent ? null : (
            <>
              <TextField
                label={t('friends.share.remind_days')}
                value={remindValue}
                onChangeText={(value) => {
                  setRemindTouched(true);
                  setRemindDays(value);
                }}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Text className="mb-3 -mt-2 text-caption leading-4 text-ink-soft">{t('friends.share.remind_hint')}</Text>
            </>
          )}

          {/* Sert uniquement au propriétaire, dans l'écran de gestion :
              plusieurs codes sur la même Habitation sont indiscernables
              sans un nom (« Locataires juillet », « Voisins »). */}
          <TextField
            label={t('friends.share.label_optional')}
            value={label}
            onChangeText={setLabel}
            placeholder={t('friends.share.label_placeholder')}
            maxLength={40}
          />

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
          <Text className="mb-4 text-heading font-bold text-ink">{t('friends.share.result_title')}</Text>
          <QrCode value={formatInviteQrValue(resultInvite.code)} size={200} />
          <Text className="mt-4 text-subheading font-bold tracking-widest text-ink">{resultInvite.code}</Text>
          {/* La durée réelle du code, et non un « 7 jours » écrit en dur :
              elle se règle librement, et un code permanent n'expire pas. */}
          <Text className="mt-1 text-center text-caption text-ink-soft">
            {resultInvite.expires_at === null
              ? t('friends.share.result_permanent')
              : t('friends.share.result_expires', {
                  date: new Date(resultInvite.expires_at).toLocaleDateString(i18n.language, {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
          </Text>
          <View className="mt-6 w-full gap-3">
            <Button label={t('friends.share.share_button')} onPress={handleShare} />
            <Button label={t('common.close')} variant="ghost" onPress={onClose} />
          </View>
        </View>
      ) : null}
    </BottomSheetModal>
  );
}
