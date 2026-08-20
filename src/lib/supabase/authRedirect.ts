import type { SupportedLanguage } from '../i18n';
import { CEOU_WEB_BASE } from '../links';

// Destination des liens contenus dans les e-mails d'authentification.
//
// Historiquement, aucun `redirectTo` n'était passé à l'inscription : Supabase
// retombait donc sur la « Site URL » du projet, restée à sa valeur d'usine
// (http://localhost:3000). Cliquer sur le lien de confirmation menait à une
// page d'erreur de navigateur alors que le compte venait d'être activé.
//
// On vise désormais explicitement une page statique servie par GitHub Pages
// depuis `docs/index.html` de ce dépôt. Une Edge Function Supabase avait
// d'abord été écrite et déployée pour ce rôle, puis retirée : la passerelle
// *.supabase.co réécrit le Content-Type de toute réponse en `text/plain` et
// impose `Content-Security-Policy: default-src 'none'; sandbox` (protection
// anti-hameçonnage), ce qui rend impossible d'y servir une vraie page HTML.
//
// Passer l'URL EXPLICITEMENT à chaque appel plutôt que de compter sur la
// Site URL du tableau de bord : le flux ne dépend ainsi que du code versionné
// ici, et un réglage distant modifié par erreur ne peut plus le casser en
// silence. L'URL doit tout de même figurer dans la liste blanche de
// redirection du projet Supabase — Auth refuse tout `redirect_to` non
// autorisé.

export type AuthEmailFlow = 'signup' | 'recovery' | 'email_change';

export function authRedirectUrl(flow: AuthEmailFlow, language: string): string {
  // `i18n.language` peut valoir « fr-FR » ; la page n'en connaît que le
  // préfixe, et retombe de toute façon sur le français pour tout le reste.
  const lang: SupportedLanguage = language.toLowerCase().startsWith('en') ? 'en' : 'fr';
  return `${CEOU_WEB_BASE}?flow=${flow}&lang=${lang}`;
}
