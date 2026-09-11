import type { TFunction } from 'i18next';
import { Alert } from 'react-native';

// Même boîte de dialogue (titre + message + Annuler/Supprimer) répétée telle
// quelle devant chaque suppression de l'app (Habitation, Pièce, Emplacement,
// Conteneur, Objet, Plan) — factorisée ici plutôt que dupliquée à chaque
// écran. `onConfirm` peut être async (ex: la fiche Objet attend la
// suppression avant de faire `router.back()`).
export function confirmDelete(
  t: TFunction,
  titleKey: string,
  messageKey: string,
  onConfirm: () => void | Promise<void>,
  // Valeurs d'interpolation du message, quand il en demande. Ajouté pour la
  // fiche Objet, qui doit annoncer COMBIEN de preuves d'achat partiront avec
  // l'objet : une suppression en entraîne une autre, et c'est exactement ce
  // qu'une boîte de confirmation existe pour dire.
  values?: Record<string, unknown>,
): void {
  Alert.alert(t(titleKey), t(messageKey, values), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: onConfirm },
  ]);
}
