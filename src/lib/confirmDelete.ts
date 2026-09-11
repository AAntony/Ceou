import type { TFunction } from 'i18next';
import { showDialog } from './dialog';

// Même boîte de dialogue (titre + message + Annuler/Supprimer) répétée telle
// quelle devant chaque suppression de l'app (Habitation, Pièce, Emplacement,
// Conteneur, Objet, Plan) — factorisée ici plutôt que dupliquée à chaque
// écran. `onConfirm` peut être async (ex: la fiche Objet attend la
// suppression avant de faire `router.back()`).
//
// Passée d'`Alert.alert` à `showDialog` le 2026-09-11 : c'est la boîte de
// l'app qui s'ouvre désormais, pas celle du système. Ces trois lignes
// portaient à elles seules la moitié des confirmations de l'app — leur
// migration a suffi à en changer autant d'un coup.
//
// L'ORDRE DES DEUX BOUTONS EST INVERSÉ par rapport à l'appel d'avant, et ce
// n'est pas un oubli : empilés, « Supprimer » monte en tête comme l'action
// attendue, « Annuler » passe dessous — c'est-à-dire sous le pouce, là où un
// appui distrait ne détruit rien. Voir AppDialogHost, qui applique la règle
// pour toutes les boîtes.
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
  showDialog({
    title: t(titleKey),
    message: t(messageKey, values),
    actions: [
      { label: t('common.delete'), destructive: true, onPress: onConfirm },
      { label: t('common.cancel'), cancel: true },
    ],
  });
}
