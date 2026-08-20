// Adresses publiques de Ceou sur le web.
//
// Une seule page statique (docs/index.html de ce dépôt, servie par GitHub
// Pages) rend deux services distincts : l'atterrissage des liens envoyés par
// e-mail par Supabase Auth, et l'ouverture d'une invitation scannée. Les deux
// partagent la même base, d'où ce module plutôt qu'une chaîne recopiée.
//
// Pourquoi GitHub Pages : le projet n'a ni nom de domaine ni hébergeur, et
// une Edge Function Supabase ne peut pas servir de HTML (la passerelle
// *.supabase.co réécrit le Content-Type en text/plain et impose un CSP
// sandbox, protection anti-hameçonnage du domaine).
export const CEOU_WEB_BASE = 'https://aantony.github.io/Ceou/';

// Un QR d'invitation encode cette URL et non plus la chaîne brute
// `ceou:invite:CODE`. C'est LA raison d'être du changement : l'appareil photo
// natif d'un téléphone ne sait rien faire d'un schéma inconnu — un visiteur
// qui n'a pas encore l'app voyait du texte incompréhensible. Une URL https
// s'ouvre partout, et la page se charge de proposer l'app ou le code.
export function inviteWebUrl(code: string): string {
  return `${CEOU_WEB_BASE}?invite=${encodeURIComponent(code)}`;
}
