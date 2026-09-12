// LES CLASSES DE BOUTONS DE L'APP, DECLAREES A UN SEUL ENDROIT.
//
// Elles vivaient jusqu'ici en litteral dans Button.tsx, recopiees d'une
// branche a l'autre du composant : `rounded-xl px-4 py-3.5` apparaissait
// trois fois, `active:opacity-80` quatre, et rien n'empechait un ecran
// d'inventer sa propre pastille pressable a cote. Nommees ici, elles se
// relisent d'un coup d'oeil, se comparent entre variantes, et un composant
// qui a besoin d'un bouton pas tout a fait standard peut REPRENDRE la meme
// base au lieu de la reecrire de memoire.
//
// Ce fichier est dans le glob de contenu de tailwind.config.js
// (`./src/**/*.{js,jsx,ts,tsx}`) : les classes ci-dessous sont donc bien
// generees, meme si elles ne sont jamais ecrites dans un `className` ici.
// En revanche elles doivent rester des chaines COMPLETES et litterales —
// une classe assemblee morceau par morceau (`` `bg-${tone}` ``) ne serait pas
// vue par le scanner et ne produirait aucun style.
//
// A QUOI SERT CHAQUE VARIANTE (le choix se fait sur le ROLE, pas sur l'allure) :
//
// - `primary`  : l'action principale d'un ecran ou d'une feuille. Une seule
//                a la fois, sinon aucune n'est principale.
// - `ghost`    : une action discrete a cote d'une principale (Annuler). Pas
//                de fond : elle doit se lire comme une porte de sortie, pas
//                comme un second choix a peser.
// - `outline`  : action secondaire qui doit quand meme se reconnaitre comme
//                cliquable au premier coup d'oeil (« Partager mon code »).
//                Ne pas y migrer les `ghost` sans raison : le contour appuie,
//                et tout appuyer revient a ne rien appuyer.
// - `danger`   : pastille rouge compacte, LE bouton de suppression de l'app,
//                partage par toutes les fiches (Groupe, Ami, Objet, forme du
//                Plan, pastille d'Emplacement) pour rester homogene d'un
//                ecran a l'autre plutot que chacun sa variante de texte rouge.
// - `destructive` : la CONFIRMATION du geste irreversible, dans la boite de
//                dialogue ou elle est l'action principale. Meme forme que
//                `primary`, en rouge. La nuance avec `danger` tient en un mot :
//                `danger` DEMANDE la suppression depuis une fiche,
//                `destructive` la VALIDE depuis la boite qui s'ouvre ensuite —
//                d'ou la meme couleur, et la forme du bouton principal.
// - `tile`     : carte-bouton avec pastille d'icone, pour deux ou trois
//                actions de MEME RANG posees cote a cote (Deplacer / Preter
//                sur la fiche d'un objet). L'icone fait le travail que le
//                libelle seul ne faisait pas : reperer l'action sans lire.
//                A poser dans un ButtonRow, qui gere la mise cote a cote et
//                l'empilement en gros texte.
export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'destructive' | 'tile';

// Le socle commun : tout bouton de l'app centre son contenu et s'attenue
// sous le doigt. Une pression qui ne repond pas laisse croire au bouton mort.
export const BUTTON_BASE = 'min-h-[48px] items-center justify-center active:opacity-80';

// Les trois GABARITS de forme, separes des couleurs : c'est ce qui permet de
// dire « meme forme que primary, autre couleur » sans recopier les mesures.
export const BUTTON_BLOCK = 'rounded-xl px-4 py-3.5';
export const BUTTON_PILL = 'self-center rounded-full px-6 py-2.5';
export const BUTTON_TILE = 'gap-2 rounded-2xl px-3 py-4';

// Un bouton inactif reste LISIBLE et reste a sa place : on l'attenue, on ne
// le retire pas. Une action qui disparait quand elle devient indisponible
// fait sauter la mise en page et laisse croire qu'elle n'a jamais existe.
export const BUTTON_DISABLED = 'opacity-50';

export const BUTTON_SURFACE: Record<ButtonVariant, string> = {
  primary: `${BUTTON_BASE} ${BUTTON_BLOCK} bg-coral`,
  ghost: `${BUTTON_BASE} ${BUTTON_BLOCK} bg-transparent`,
  outline: `${BUTTON_BASE} ${BUTTON_BLOCK} border-2 border-coral bg-coral-light`,
  danger: `${BUTTON_BASE} ${BUTTON_PILL} bg-red-700`,
  // Le MEME rouge que la pastille, volontairement : c'est le meme geste, vu a
  // deux moments. Un second rouge ferait douter qu'il s'agisse du meme.
  destructive: `${BUTTON_BASE} ${BUTTON_BLOCK} bg-red-700`,
  tile: `${BUTTON_BASE} ${BUTTON_TILE} border border-ink/10 bg-surface`,
};

// Le libelle est CENTRE partout : en gros texte il passe sur deux lignes, et
// un alignement a gauche desaxerait tout le bouton.
export const BUTTON_LABEL: Record<ButtonVariant, string> = {
  primary: 'text-center text-body font-semibold text-white',
  ghost: 'text-center text-body font-semibold text-ink',
  outline: 'text-center text-body font-semibold text-coral-dark',
  danger: 'text-center text-label font-semibold text-white',
  destructive: 'text-center text-body font-semibold text-white',
  tile: 'text-center text-label font-semibold text-ink',
};

// LA TUILE A UNE HAUTEUR PLANCHER, et c'est ce qui la rend utilisable a deux.
// Cote a cote, chaque tuile n'a qu'une demi-largeur : « Deplacer » tient sur
// une ligne, « Preter ou emprunter » sur deux. Sans plancher commun, les deux
// cartes n'ont pas la meme hauteur et la rangee penche. La valeur couvre la
// pastille, l'ecart et deux lignes de libelle.
export const TILE_MIN_HEIGHT = 116;

// Diametre de la pastille d'icone d'une tuile. Passe tel quel a IconBadge,
// qui applique lui-meme le reglage de taille de l'app.
export const TILE_BADGE_SIZE = 44;
