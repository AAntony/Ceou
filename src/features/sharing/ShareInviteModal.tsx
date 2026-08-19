import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { QrCode } from '../../components/QrCode';
import { logClientError } from '../../lib/errorLogging';
import type { HabitationPermission, ShareInvite } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { useHabitations } from '../inventory/queries';
import { PermissionPicker } from './PermissionPicker';
import { formatInviteQrValue, useCreateShareInvite } from './queries';

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
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: habitations } = useHabitations();
  const createInvite = useCreateShareInvite();

  const [step, setStep] = useState<Step>('configure');
  const [targetType, setTargetType] = useState<TargetType>('friend');
  const [selectedHabitationIds, setSelectedHabitationIds] = useState<string[]>([]);
  const [permission, setPermission] = useState<HabitationPermission>('consultation');
  const [resultInvite, setResultInvite] = useState<ShareInvite | null>(null);

  useEffect(() => {
    if (visible) {
      setStep('configure');
      setTargetType('friend');
      setSelectedHabitationIds([]);
      setPermission('consultation');
      setResultInvite(null);
    }
  }, [visible]);

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
      const invite = await createInvite.mutateAsync({
        habitationIds: selectedHabitationIds,
        permission: targetType === 'guest' ? 'consultation' : permission,
        targetType,
      });
      setResultInvite(invite);
      setStep('result');
    } catch (err) {
      logClientError(err, { source: 'share_invite', targetType, habitationCount: selectedHabitationIds.length });
      Alert.alert(t('common.error_generic'));
    }
  };

  const handleShare = async () => {
    if (!resultInvite) return;
    try {
      await Share.share({ message: t('friends.share.share_message', { code: resultInvite.code }) });
    } catch {
      // L'utilisateur a simplement fermé la feuille de partage — rien à faire.
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-white px-6 pt-6"
      sheetStyle={{ maxHeight: '85%' }}
    >
      {step === 'configure' ? (
        <ScrollView keyboardShouldPersistTaps="handled">
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
                  <Icon name={selected ? 'included' : 'excluded'} size={20} color={selected ? '#4CAF50' : '#A39C8F'} />
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
            <Text className="mt-2 text-xs text-ink-soft">{t('friends.share.guest_permission_note')}</Text>
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
