import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { parseScannedCode, useRedeemShareInvite, useSendFriendRequest } from './queries';
import { QrScanner } from './QrScanner';

type AddFriendModalProps = {
  visible: boolean;
  onClose: () => void;
};

// Les erreurs remontées par les RPC (send_friend_request/redeem_share_invite)
// sont des messages Postgres bruts (RAISE EXCEPTION 'xxx') — reconnus ici
// pour afficher un message clair plutôt que l'erreur générique.
const ERROR_KEYS: Record<string, string> = {
  friend_code_not_found: 'friends.add.error_not_found',
  cannot_add_self: 'friends.add.error_self',
  friendship_already_exists: 'friends.add.error_exists',
  invite_not_found: 'friends.add.error_invite_not_found',
  invite_already_redeemed: 'friends.add.error_invite_redeemed',
  invite_expired: 'friends.add.error_invite_expired',
  cannot_redeem_own_invite: 'friends.add.error_own_invite',
};

// `instanceof Error` ne suffit PAS ici : confirmé en test réel que l'objet
// d'erreur renvoyé par supabase-js pour un RPC en échec n'est PAS reconnu
// comme une instance d'Error au runtime (raison exacte non élucidée —
// possiblement une frontière de bundle/realm), alors que `.message` existe
// bel et bien dessus. Résultat observé avant ce correctif : TOUTE erreur
// RPC (code introuvable, déjà en contact, auto-ajout...) retombait sur le
// message générique au lieu du message spécifique correspondant. Test par
// duck-typing (présence d'un `.message` string) plutôt que par prototype.
function friendlyErrorKey(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : '';
  return ERROR_KEYS[message] ?? 'common.error_generic';
}

// Deux chemins d'ajout, comme demandé : taper le code ami permanent
// (contact simple, sans partage) ou scanner un QR — qui peut être soit le
// même code ami (formatFriendCodeQrValue), soit une invitation éphémère
// avec Habitations/droit déjà configurés (formatInviteQrValue) — le préfixe
// encodé dans le QR (voir parseScannedCode) dit laquelle des deux RPC
// appeler, sans ambiguïté possible.
export function AddFriendModal({ visible, onClose }: AddFriendModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const sendRequest = useSendFriendRequest();
  const redeemInvite = useRedeemShareInvite();

  useEffect(() => {
    if (visible) setCode('');
  }, [visible]);

  const handleSubmitCode = async () => {
    if (!code.trim()) return;
    try {
      await sendRequest.mutateAsync(code.trim());
      onClose();
    } catch (error) {
      Alert.alert(t(friendlyErrorKey(error)));
    }
  };

  const handleScanned = async (raw: string) => {
    setScannerVisible(false);
    const parsed = parseScannedCode(raw);
    try {
      if (parsed.type === 'friend') {
        await sendRequest.mutateAsync(parsed.code);
      } else if (parsed.type === 'invite') {
        await redeemInvite.mutateAsync(parsed.code);
      } else {
        Alert.alert(t('friends.add.invalid_qr'));
        return;
      }
      onClose();
    } catch (error) {
      Alert.alert(t(friendlyErrorKey(error)));
    }
  };

  return (
    <>
      <BottomSheetModal visible={visible} onClose={onClose} sheetClassName="rounded-t-3xl bg-white px-6 pb-8 pt-6">
        <Text className="mb-4 text-xl font-bold text-ink">{t('friends.add.title')}</Text>
        <TextField label={t('friends.add.code_label')} value={code} onChangeText={setCode} autoCapitalize="characters" autoFocus />
        <View className="mb-4 mt-2">
          <Button
            label={t('friends.add.submit')}
            onPress={handleSubmitCode}
            loading={sendRequest.isPending}
            disabled={!code.trim()}
          />
        </View>
        <View className="mb-4 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-ink/10" />
          <Text className="text-xs text-ink-soft">{t('friends.add.or')}</Text>
          <View className="h-px flex-1 bg-ink/10" />
        </View>
        <Button label={t('friends.add.scan')} variant="ghost" onPress={() => setScannerVisible(true)} />
      </BottomSheetModal>
      <QrScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScanned={handleScanned} />
    </>
  );
}
