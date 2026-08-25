import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomSheetModalProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  sheetClassName?: string;
  sheetStyle?: StyleProp<ViewStyle>;
  /**
   * Borne la feuille a la hauteur de l'ecran et fait defiler son contenu.
   *
   * A poser sur TOUTE feuille dont le contenu grandit avec le reglage de
   * taille du texte — c'est-a-dire a peu pres toutes. Voir le piege de
   * hauteur documente plus bas : sans borne, une feuille trop haute sort par
   * le HAUT et son titre devient invisible.
   *
   * Le ScrollView est pose ICI, donc enfant DIRECT de la feuille, ce qui est
   * la condition pour que le plafond porte sur ce qui defile. Ne pas en
   * remettre un a l'interieur : deux ScrollViews imbriques verticalement se
   * disputent le geste.
   */
  scrollable?: boolean;
}>;

// Plafond applique par `scrollable`. Pas 100 % : la bande restante montre le
// fond assombri, seul indice qu'un appui a cote referme la feuille.
const SCROLLABLE_MAX_HEIGHT = '88%';

const DEFAULT_SHEET_CLASSNAME = 'rounded-t-3xl bg-surface';

// Squelette commun à TOUTE feuille de bas d'écran de l'app (fiche de forme
// du Plan, création/édition d'entité, formulaire Objet...) : fond
// semi-transparent qui ferme au tap, comportement par défaut plutôt qu'une
// exception ajoutée écran par écran. `sheetClassName`/`sheetStyle` laissent
// chaque appelant garder son padding propre (le formulaire Objet, par
// exemple, n'a pas le même que la fiche de forme du Plan).
//
// ⚠️ LE FOND EST UN FRÈRE DE LA FEUILLE, PAS SON PARENT. Il l'a enveloppée
// jusqu'au 2026-08-26, et la feuille devait alors être elle-même un
// `Pressable` au `onPress` vide pour empêcher qu'un tap sur son contenu ne
// remonte jusqu'au fond et la referme. Ce Pressable-là entrait en
// concurrence avec le ScrollView pour le geste : sur Android, un ancêtre
// pressable réclame le responder au premier contact, si bien que le
// défilement ne démarrait que là où le ScrollView gagnait la course — d'où
// un scroll « capricieux, qui ne fonctionne pas toujours » (retour
// utilisateur). Posé en frère absolu DERRIÈRE la feuille, le fond garde
// exactement le même comportement (un tap à côté ferme) sans qu'aucun
// pressable ne surplombe le contenu : un toucher sur la feuille remonte
// jusqu'à elle et s'y arrête, les frères en dessous ne sont jamais
// consultés. NE PAS revenir à un fond enveloppant.
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
// warning). Trois recettes selon le besoin :
// - contenu court, qui doit juste s'afficher en entier → AUCUNE propriété
//   flex nulle part et pas de `sheetStyle` (branche manuelle de
//   CreateObjetModal) ;
// - contenu qui doit remplir un cadre stable → `sheetStyle={{ height }}`
//   (hauteur DÉFINIE) et là `flex: 1` fonctionne normalement (branche scan
//   de CreateObjetModal) ;
// - contenu qui peut dépasser l'écran et doit défiler sous un plafond →
//   `scrollable`, qui pose `maxHeight` + `flexShrink: 1` sur le ScrollView
//   (FriendDetailSheet, ShareInviteModal, CreateEntityModal et cinq autres).
//   Cette recette exige que le ScrollView soit l'ENFANT DIRECT de la
//   feuille. Elle a échoué dans CreateObjetModal, où le ScrollView est
//   enfoui d'un niveau (un View enveloppe ObjetFormBody, qui a le sien) :
//   le plafond porte alors sur le View, pas sur ce qui défile.
//
// ⚠️ LA PREMIÈRE RECETTE N'EST PLUS UN DÉFAUT SÛR depuis que la taille du
// texte est réglable. « Contenu court » l'est à taille normale ; à x1,6 le
// même contenu dépasse l'écran, et une feuille sans plafond sort alors par
// le HAUT — titre invisible, défilement erratique (CreateEntityModal, retour
// du 2026-08-26). Toute feuille dont le contenu grandit avec le texte veut
// la troisième recette.
// À vérifier sur téléphone, pas dans le navigateur : react-native-web
// retombe sur le dimensionnement max-content du CSS et ne reproduit pas le
// bug.
export function BottomSheetModal({
  visible,
  onClose,
  sheetClassName,
  sheetStyle,
  scrollable,
  children,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        {/* Le fond ferme la feuille : c'est la seule sortie pour qui ne
            voit pas le bouton du bas, donc il doit s'annoncer. Déclaré en
            premier, donc peint DERRIÈRE la feuille. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          className="bg-black/40"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />

        <View
          className={sheetClassName ?? DEFAULT_SHEET_CLASSNAME}
          // Le style de l'appelant passe EN DERNIER : il peut donc imposer
          // sa propre hauteur par-dessus le plafond.
          style={[scrollable ? { maxHeight: SCROLLABLE_MAX_HEIGHT } : null, sheetStyle]}
        >
          {scrollable ? (
            // `flexShrink` et surtout pas `flex` : voir le piege ci-dessus.
            // Le ScrollView garde `flexBasis: auto`, donc il est mesure sur
            // son contenu et ne retrecit qu'une fois le plafond atteint —
            // moment ou il se met enfin a defiler.
            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            children
          )}
          <View style={{ height: insets.bottom }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
