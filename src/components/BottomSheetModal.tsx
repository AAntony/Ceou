import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomSheetModalProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  sheetClassName?: string;
  sheetStyle?: StyleProp<ViewStyle>;
}>;

const DEFAULT_SHEET_CLASSNAME = 'rounded-t-3xl bg-white';

// Squelette commun à TOUTE feuille de bas d'écran de l'app (fiche de forme
// du Plan, création/édition d'entité, formulaire Objet...) : fond
// semi-transparent qui ferme au tap, comportement par défaut plutôt qu'une
// exception ajoutée écran par écran — un tap sur la feuille elle-même ne doit
// PAS fermer, d'où le second Pressable qui absorbe son propre tap (onPress
// vide) avant qu'il ne remonte jusqu'au fond. `sheetClassName`/`sheetStyle`
// laissent chaque appelant garder son padding propre (le formulaire Objet,
// par exemple, n'a pas le même que la fiche de forme du Plan).
//
// Deux comportements posés ICI, une seule fois pour toutes les feuilles
// (retour utilisateur du 2026-08-17 : plusieurs boutons "Générer"/
// "Supprimer" étaient inatteignables sous la barre de gestes Android, et le
// clavier cachait le champ en cours d'édition) :
// - `KeyboardAvoidingView` : un `Modal` RN ouvre sa propre fenêtre native,
//   qui ne bénéficie PAS automatiquement du redimensionnement clavier de
//   l'écran parent — sans ça, le clavier se pose par-dessus le formulaire
//   au lieu de le pousser vers le haut.
// - Le `View` final de hauteur `insets.bottom` réserve la zone des boutons
//   système sous le DERNIER élément de la feuille, en plus du padding
//   propre à chaque appelant (jamais à sa place, en plus) — fonctionne que
//   `children` soit un `ScrollView` (le spacer reste hors de la zone
//   scrollable, donc toujours visible) ou un simple `View`.
// ⚠️ PIÈGE DE HAUTEUR, rencontré trois fois (FriendDetailSheet,
// ShareInviteModal, CreateObjetModal) : la feuille n'a JAMAIS de hauteur
// définie par défaut, elle se mesure sur son contenu. Un enfant en
// `flex: 1` y passe donc à `flexBasis: 0` et ne compte pour RIEN dans
// cette mesure — la feuille se réduit à ses éléments non-flex et l'enfant
// est rendu avec une hauteur nulle (contenu invisible, pas d'erreur, pas de
// warning). Deux recettes selon le besoin :
// - contenu qui doit s'adapter puis défiler → `sheetStyle={{ maxHeight }}`
//   + `flexShrink: 1` (jamais `flex: 1`) sur l'enfant ET sur son ScrollView
//   (dont le défaut RN est `flexShrink: 0`, contrairement au CSS) ;
// - contenu qui doit remplir un cadre stable → `sheetStyle={{ height }}`
//   (hauteur DÉFINIE) et là `flex: 1` fonctionne normalement.
// À vérifier sur téléphone, pas dans le navigateur : react-native-web
// retombe sur le dimensionnement max-content du CSS et ne reproduit pas le
// bug.
export function BottomSheetModal({ visible, onClose, sheetClassName, sheetStyle, children }: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable onPress={() => {}} className={sheetClassName ?? DEFAULT_SHEET_CLASSNAME} style={sheetStyle}>
            {children}
            <View style={{ height: insets.bottom }} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
