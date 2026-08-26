import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { looksLikeInviteCode, parseScannedCode, useRedeemShareInvite, useSendFriendRequest } from './queries';
import { rpcErrorCode } from './rpcError';
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
  invite_exhausted: 'friends.add.error_invite_exhausted',
  cannot_redeem_own_invite: 'friends.add.error_own_invite',
};

// L'extraction du code d'erreur brut vit maintenant dans rpcError.ts —
// l'écran d'entrée visiteur en a besoin aussi, et son contournement de
// duck-typing (documenté là-bas) est trop subtil pour être recopié.
function friendlyErrorKey(error: unknown): string {
  return ERROR_KEYS[rpcErrorCode(error)] ?? 'common.error_generic';
}

// Deux chemins d'ajout, et un seul code : taper le code ami permanent, ou
// scanner le QR qui porte ce même code. C'est désormais la SEULE façon de
// devenir ami — les codes générés ne servent plus qu'à l'accès invité (voir
// ShareInviteModal et la migration 20260826100000). On ne choisit rien ici :
// ce qu'on partage à l'autre se règle depuis sa fiche, une fois la demande
// acceptée.
//
// Le scanner accepte quand même un QR d'invitation, parce qu'un invité peut
// très bien avoir un compte : il entre alors en consultation, ce que l'on
// annonce explicitement plutôt que de refermer la feuille sans un mot.
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
    // Un code d'invitation tapé ici ne trouverait aucun profil : le dire
    // avant l'aller-retour, et surtout le dire précisément — « aucun compte
    // ne correspond » laisserait croire à une faute de frappe.
    if (looksLikeInviteCode(code)) {
      Alert.alert(t('friends.add.error_guest_code'));
      return;
    }
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
        const result = await redeemInvite.mutateAsync(parsed.code);
        // Aucun ami n'a été ajouté : ce QR ouvrait un accès invité. Sans ce
        // message, la feuille se refermait et une habitation inconnue
        // apparaissait sur l'accueil sans explication.
        if (result.type === 'guest') Alert.alert(t('friends.add.guest_redeemed'));
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
      <BottomSheetModal visible={visible} onClose={onClose} sheetClassName="rounded-t-3xl bg-surface px-6 pb-8 pt-6" scrollable>
        <Text className="mb-4 text-heading font-bold text-ink">{t('friends.add.title')}</Text>
        <Text className="mb-4 -mt-2 text-label leading-5 text-ink-soft">{t('friends.add.intro')}</Text>
        <TextField
          label={t('friends.add.code_label')}
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase())}
          autoCapitalize="characters"
          placeholder={t('friends.add.code_placeholder')}
          maxLength={10}
          autoFocus
        />
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
          <Text className="text-caption text-ink-soft">{t('friends.add.or')}</Text>
          <View className="h-px flex-1 bg-ink/10" />
        </View>
        <Button label={t('friends.add.scan')} variant="ghost" onPress={() => setScannerVisible(true)} />
      </BottomSheetModal>
      <QrScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScanned={handleScanned} />
    </>
  );
}
