import type { PropsWithChildren } from 'react';
import { Modal, Pressable, type StyleProp, type ViewStyle } from 'react-native';

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
export function BottomSheetModal({ visible, onClose, sheetClassName, sheetStyle, children }: BottomSheetModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable onPress={() => {}} className={sheetClassName ?? DEFAULT_SHEET_CLASSNAME} style={sheetStyle}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
