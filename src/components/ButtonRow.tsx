import { Children, createContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { STACK_SCALE, useTextScale } from '../lib/textScale';

type ButtonRowProps = {
  children: ReactNode;
};

export const EqualHeightButtonContext = createContext(false);

// DEUX (OU TROIS) ACTIONS DE MEME RANG, COTE A COTE, A LARGEUR EGALE.
//
// Cote a cote, elles se lisent comme UN choix : « je deplace, ou je prete ».
// Empilees, elles se lisaient comme une liste de reglages qu'on parcourt —
// c'est le defaut de la fiche d'un objet, ou « Deplacer » et « Preter ou
// emprunter » etaient deux libelles gris l'un sous l'autre.
//
// EN GROS TEXTE, ELLES S'EMPILENT, pour la meme raison que dans FormActions :
// a demi-largeur un libelle est coupe en plein milieu d'un mot, et la cible du
// geste devient difficile a viser — precisement pour ceux qui ont demande du
// gros texte.
//
// Un enfant `null` (une action que l'ecran masque, comme « Preter » quand un
// pret est deja en cours) est ecarte par `Children.toArray` : le survivant
// prend alors toute la largeur, sans trou ni demi-rangee.
//
// PAS FUSIONNE AVEC FormActions, qui fait pourtant la meme bascule : ce
// couple-la INVERSE en plus l'ordre de ses deux boutons en s'empilant
// (« Valider » remonte en tete), regle propre au couple annuler/valider et
// qui n'aurait aucun sens pour deux actions de meme rang.
export function ButtonRow({ children }: ButtonRowProps) {
  const { textScale } = useTextScale();
  const items = Children.toArray(children);
  const stacked = textScale >= STACK_SCALE || items.length < 2;

  if (stacked) {
    return (
      <View className="gap-3">
        {items.map((item, index) => (
          <View key={index}>{item}</View>
        ))}
      </View>
    );
  }

  return (
    <EqualHeightButtonContext.Provider value>
    <View className="flex-row gap-3">
      {items.map((item, index) => (
        <View key={index} className="flex-1">
          {item}
        </View>
      ))}
    </View>
    </EqualHeightButtonContext.Provider>
  );
}
