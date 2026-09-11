import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  closeTopDialog,
  getDialogQueue,
  subscribeToDialogs,
  type DialogAction,
  type DialogRequest,
} from '../lib/dialog';
import { useScaled } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';
import { Button } from './Button';
import type { ButtonVariant } from './buttonStyles';
import { Icon } from './Icon';

// LA BOITE DE DIALOGUE DE L'APP, DESSINEE UNE FOIS POUR TOUTES.
//
// Montee a la racine (app/_layout.tsx) et nulle part ailleurs : c'est ce qui
// permet a `showDialog` d'etre appele depuis un hook ou un `catch`, sans que
// l'ecran concerne ait a porter un etat ni un composant. Voir lib/dialog.ts
// pour le pourquoi du relais.
//
// CE QU'ELLE REPREND DE BottomSheetModal, deliberement, pour que les deux
// fenetres de l'app se ressemblent : le meme fond `bg-black/40`, le meme
// geste (un appui a cote referme), et le fond declare en FRERE de la carte
// plutot qu'en parent — un Pressable enveloppant se disputerait le geste avec
// le ScrollView, defaut deja paye une fois sur les feuilles.
//
// ELLE S'OUVRE SOUVENT PAR-DESSUS UNE FEUILLE (une erreur de sauvegarde dans
// le formulaire d'une facture, une suppression demandee depuis une fiche).
// Deux `Modal` RN vivants en meme temps, donc : sur Android chacun est une
// fenetre, la derniere ouverte passe devant, et c'est le cas courant ici. A
// revoir a la premiere construction iOS, ou la presentation en cascade des
// controleurs est plus chatouilleuse.
export function AppDialogHost() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const tailleBadge = useScaled(52);
  const file = useSyncExternalStore(subscribeToDialogs, getDialogQueue, getDialogQueue);
  const demande = file[0];

  // LA DERNIERE DEMANDE SURVIT A SA FERMETURE, le temps du fondu. Sans elle,
  // le contenu disparait a l'instant ou `visible` passe a faux et on voit
  // s'effacer un fond sombre VIDE — un eclair qui donne l'impression d'un
  // bug plutot que d'une reponse enregistree.
  const derniere = useRef<DialogRequest | undefined>(undefined);
  if (demande) derniere.current = demande;
  const affichee = demande ?? derniere.current;

  // Fermer SANS choisir : l'appui a cote, et le bouton Retour d'Android
  // (`onRequestClose`). La demande est relue dans la file au moment du geste
  // plutot que capturee : entre deux rendus, c'est elle qui fait foi.
  const fermer = useCallback(() => {
    const courante = getDialogQueue()[0];
    if (!courante) return;
    closeTopDialog();
    courante.onDismiss?.();
  }, []);

  const repondre = useCallback((action: DialogAction) => {
    // FERMER D'ABORD : l'action peut en ouvrir une autre (un « Supprimer »
    // qui echoue et annonce l'erreur). Dans cet ordre la file avance d'un
    // cran et la fenetre change de contenu sans se refermer entre les deux.
    closeTopDialog();
    // Le retour eventuel n'est pas attendu — comme le faisait `Alert.alert` :
    // chaque appelant gere deja son echec, et rien ici ne saurait quoi en
    // dire.
    void action.onPress?.();
  }, []);

  const actions = ordonnerActions(affichee?.actions, t('common.close'));
  const ordinaire = actions.find((action) => !action.cancel && !action.destructive);
  // La pastille rouge n'est pas un ornement : elle dit, avant meme qu'on lise
  // le titre, que cette boite-ci porte un geste qu'on ne rattrape pas.
  const irreversible = actions.some((action) => action.destructive);

  return (
    <Modal visible={demande != null} transparent animationType="fade" onRequestClose={fermer}>
      <View className="flex-1 items-center justify-center px-6">
        {/* Declare en premier, donc peint DERRIERE la carte. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          className="bg-black/40"
          onPress={fermer}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />

        {affichee ? (
          <View
            accessibilityViewIsModal
            accessibilityRole="alert"
            // La bordure n'est pas decorative : en theme sombre, une carte
            // `bg-surface` posee sur un fond deja noirci par le voile ne se
            // detache plus de lui. Meme trait que les cartes de l'app.
            className="w-full rounded-3xl border border-ink/10 bg-surface px-6 pb-6 pt-7"
            // Le plafond de hauteur et le ScrollView juste en dessous : a
            // 200 % de texte, un titre suivi de deux phrases et de trois
            // boutons depasse l'ecran. Les BOUTONS RESTENT HORS du defilement
            // — une boite dont la reponse est sous le bord n'a pas de reponse.
            style={{ maxWidth: 420, maxHeight: '85%', ...OMBRE }}
          >
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ alignItems: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              {irreversible ? (
                <View
                  style={{ width: tailleBadge, height: tailleBadge, borderRadius: tailleBadge / 2 }}
                  className="mb-4 items-center justify-center bg-red-500/10"
                >
                  {/* Taille NON mise a l'echelle ici : Icon s'en charge. */}
                  <Icon name="alert" size={24} color={colors.danger} />
                </View>
              ) : null}

              {affichee.title ? (
                <Text className="text-center text-heading font-semibold text-ink">{affichee.title}</Text>
              ) : null}

              {affichee.message ? (
                // SEUL, le message EST le propos de la boite : il se lit en
                // encre franche. Sous un titre, il n'en est que la
                // consequence, et s'efface d'un ton.
                <Text
                  className={
                    affichee.title
                      ? 'mt-2 text-center text-body text-ink-soft'
                      : 'text-center text-body font-medium text-ink'
                  }
                >
                  {affichee.message}
                </Text>
              ) : null}
            </ScrollView>

            {/* EMPILES ET PLEINE LARGEUR, toujours — meme regle que
                FormActions en gros texte : cote a cote, « Enregistrer » ou
                « Supprimer » se coupent en plein milieu d'un mot, et la cible
                du geste devient difficile a viser. L'action principale en
                tete, la sortie en bas : c'est l'ordre de tous les systemes, et
                c'est « Annuler » qui se retrouve sous le pouce. */}
            <View className="mt-6 gap-2">
              {actions.map((action, index) => (
                <Button
                  key={`${index}-${action.label}`}
                  label={action.label}
                  variant={varianteDe(action, ordinaire)}
                  onPress={() => repondre(action)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// `elevation` pour Android, les `shadow*` pour iOS — les deux sont
// necessaires. Plus marquee que celle des cartes : elle doit flotter au-dessus
// d'un ecran entier, pas d'une liste.
const OMBRE = {
  elevation: 8,
  shadowColor: '#000',
  shadowOpacity: 0.22,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
} as const;

// L'ANNULATION PASSE EN DERNIER quel que soit l'ordre donne par l'appelant.
// Les boites viennent d'`Alert.alert`, ou la convention iOS place « Annuler »
// en tete : les recopier telles quelles aurait mis la porte de sortie au-dessus
// de la reponse attendue, sur une partie des ecrans seulement.
function ordonnerActions(actions: DialogAction[] | undefined, labelParDefaut: string): DialogAction[] {
  if (!actions?.length) return [{ label: labelParDefaut }];
  return [...actions.filter((action) => !action.cancel), ...actions.filter((action) => action.cancel)];
}

// UNE SEULE ACTION PRINCIPALE par boite, les autres en contour : trois
// boutons pleins l'un sous l'autre ne designent plus rien.
function varianteDe(action: DialogAction, ordinaire: DialogAction | undefined): ButtonVariant {
  if (action.cancel) return 'ghost';
  if (action.destructive) return 'destructive';
  return action === ordinaire ? 'primary' : 'outline';
}
