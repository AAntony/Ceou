import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Text, View } from 'react-native';

// LE VOILE DE GÉNÉRATION, POSABLE N'IMPORTE OÙ.
//
// UNE MODALE ET NON UN CALQUE ABSOLU, parce que l'export se déclenche aussi
// depuis la feuille d'une facture — qui est elle-même une modale. Un calque
// posé dans l'écran passerait DERRIÈRE elle, et on regarderait un formulaire
// figé sans savoir pourquoi.
//
// IL BLOQUE VRAIMENT L'ÉCRAN, et c'est voulu : la génération télécharge,
// réduit et encode les documents un par un. Recocher ou modifier quoi que ce
// soit pendant ce temps produirait un fichier qui ne correspond plus à ce qui
// est affiché.
//
// LE COMPTEUR EST LÀ POUR UNE RAISON PRÉCISE : un dossier de trente factures
// prend une demi-minute, pendant laquelle rien ne bouge à l'écran. Sans
// chiffre qui avance, on croit que c'est bloqué et on quitte l'app.

type ExportProgressProps = {
  travail: { fait: number; total: number } | null;
};

export function ExportProgress({ travail }: ExportProgressProps) {
  const { t } = useTranslation();
  if (!travail) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-black/40 px-10">
        <View className="w-full items-center rounded-2xl bg-surface px-6 py-7">
          <ActivityIndicator />
          <Text className="mt-3 text-center text-body text-ink">{t('factures.export.working')}</Text>
          <Text
            className="mt-1 text-center text-label text-ink-soft"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {t('factures.export.progress', { done: travail.fait, total: travail.total })}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
