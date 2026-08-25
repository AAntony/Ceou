import { View } from 'react-native';
import { STACK_SCALE, useTextScale } from '../lib/textScale';
import { Button } from './Button';

type FormActionsProps = {
  cancelLabel: string;
  onCancel: () => void;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
};

// LE COUPLE « ANNULER / VALIDER » DE TOUS LES FORMULAIRES DE L'APP.
//
// Le même balisage était recopié dans cinq écrans (création d'entité, fiche
// de catégorie, formulaire d'objet, consentement et validation du scan IA) :
// deux boutons en `flex-1` côte à côte. Un seul endroit désormais, et surtout
// un seul endroit à corriger quand ce couple doit changer de forme.
//
// EN GRAND TEXTE, ILS S'EMPILENT. Côte à côte, chaque bouton ne dispose que
// d'une demi-largeur : « Enregistrer » à x1,6 y est coupé en plein milieu
// d'un mot. L'un sous l'autre, chacun a toute la largeur — et la cible du
// geste devient franchement plus facile à viser, ce qui sert d'abord ceux qui
// ont demandé du gros texte.
//
// L'ordre s'INVERSE en s'empilant : côte à côte, « Annuler » est à gauche
// parce qu'on lit de gauche à droite et que l'action principale se pose au
// bout. Empilés, le principal remonte en tête — c'est ce que fait tout
// système d'exploitation, et c'est le bouton qu'on cherche.
export function FormActions({
  cancelLabel,
  onCancel,
  confirmLabel,
  onConfirm,
  loading,
  disabled,
}: FormActionsProps) {
  const { textScale } = useTextScale();
  const stacked = textScale >= STACK_SCALE;

  const confirm = <Button label={confirmLabel} onPress={onConfirm} loading={loading} disabled={disabled} />;
  const cancel = <Button label={cancelLabel} variant="ghost" onPress={onCancel} />;

  if (stacked) {
    return (
      <View className="gap-2">
        {confirm}
        {cancel}
      </View>
    );
  }

  return (
    <View className="flex-row gap-3">
      <View className="flex-1">{cancel}</View>
      <View className="flex-1">{confirm}</View>
    </View>
  );
}
