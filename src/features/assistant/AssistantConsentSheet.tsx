import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { FormActions } from '../../components/FormActions';
import { TextLink } from '../../components/TextLink';

// CE QU'ON DIT À L'ASSISTANT PART CHEZ UN TIERS, ET IL FAUT LE DIRE AVANT.
//
// L'assistant vocal envoie le transcript de la phrase prononcée à l'API
// Gemini de Google, hors Union européenne (voir supabase/functions/
// interpret-command). Il le faisait déjà, sans rien demander et sans que la
// politique de confidentialité le mentionne — relevé à l'audit d'avant
// publication, alors que le scan photo, lui, faisait correctement les deux.
//
// MÊME FORME QUE LE SCAN PHOTO, volontairement : même feuille, même lien
// vers la politique, même horodatage côté profil. Ce sont deux traitements
// distincts, ils demandent deux accords distincts — mais rien ne justifie de
// les demander de deux façons différentes.
//
// POSÉE AVANT L'OUVERTURE DU MICRO, et pas avant l'envoi : demander l'accord
// une fois la phrase déjà prononcée reviendrait à faire choisir entre
// consentir et perdre ce qu'on vient de dire. Ce n'est pas un choix libre.
//
// `live` pour la conversation temps réel : même feuille, autre texte. Elle
// envoie la voix et des résultats de recherche, pas seulement une phrase —
// l'accord doit le dire tel quel.
export function AssistantConsentSheet({
  visible,
  loading,
  onAccept,
  onCancel,
  kind = 'classic',
}: {
  visible: boolean;
  loading: boolean;
  onAccept: () => void;
  onCancel: () => void;
  kind?: 'classic' | 'live';
}) {
  const { t } = useTranslation();
  const keys = kind === 'live' ? 'assistant.live.consent' : 'assistant.consent';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onCancel}
      sheetClassName="rounded-t-3xl bg-surface px-6 pb-8 pt-6"
      scrollable
    >
      <Text className="mb-3 text-subheading font-bold text-ink">{t(`${keys}.title`)}</Text>
      <Text className="mb-4 text-label leading-5 text-ink-soft">{t(`${keys}.body`)}</Text>
      <TextLink
        href="/privacy-policy"
        label={t('profile.privacy_policy')}
        className="mb-6 self-start"
        textClassName="text-label font-semibold text-coral-dark underline"
      />
      <FormActions
        cancelLabel={t('common.cancel')}
        onCancel={onCancel}
        confirmLabel={t(`${keys}.accept`)}
        onConfirm={onAccept}
        loading={loading}
      />
    </BottomSheetModal>
  );
}
