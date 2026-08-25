const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// `inlineRem: false` EST CE QUI REND LA TAILLE DU TEXTE REGLABLE.
//
// Par defaut, NativeWind convertit les `rem` de Tailwind en pixels AU MOMENT
// DU BUNDLE, avec une base figee a 14 : `text-base` arrive dans l'app comme
// `fontSize: 14`, `p-4` comme `padding: 14`. Plus rien ne peut alors les
// deplacer a l'execution — le reglage d'affichage du Profil ne changeait donc
// que ce que l'app calculait elle-meme en JavaScript (nombre de colonnes,
// taille des icones), et pas une seule taille de texte.
//
// A false, chaque valeur reste une unite `rem` resolue au rendu contre
// l'observable `rem` de NativeWind — celle que pilote lib/textScale. Le
// reglage agit alors sur TOUTES les classes du projet a la fois : tailles de
// texte, interlignes, rembourrages, hauteurs, rayons.
//
// Le cout est un calcul par valeur au rendu au lieu d'une constante. C'est
// le prix de la fonctionnalite ; il n'y a pas d'autre point d'accroche.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: false });
