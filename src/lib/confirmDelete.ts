import type { TFunction } from 'i18next';
import { Alert } from 'react-native';

// Même boîte de dialogue (titre + message + Annuler/Supprimer) répétée telle
// quelle devant chaque suppression de l'app (Habitation, Pièce, Emplacement,
// Conteneur, Objet, Plan) — factorisée ici plutôt que dupliquée à chaque
// écran. `onConfirm` peut être async (ex: la fiche Objet attend la
// suppression avant de faire `router.back()`).
export function confirmDelete(t: TFunction, titleKey: string, messageKey: string, onConfirm: () => void | Promise<void>): void {
  Alert.alert(t(titleKey), t(messageKey), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: onConfirm },
  ]);
}
