import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useIsAnonymous, useSession } from '../auth/SessionProvider';
import { registerPushToken } from './push';

// Deux responsabilités, montées une seule fois à la racine de l'app :
//   1. associer cet appareil au compte connecté (jeton Expo Push) ;
//   2. ouvrir le bon écran quand l'utilisateur tape sur une notification.

// La destination arrive dans la charge utile de la notification, donc du
// réseau. Même si le serveur est le nôtre, on ne pousse QUE des routes
// connues : une charge utile n'est pas une instruction de navigation.
const ALLOWED_ROUTES = new Set(['/friends']);

// Le web n'implémente pas la lecture de la dernière notification ouverte :
// appeler le hook y lève une erreur qui remonte jusqu'à l'ErrorBoundary et
// fait tomber toute l'application. Constante de module, donc la branche ne
// change JAMAIS d'un rendu à l'autre — l'ordre des hooks reste stable.
const CAN_READ_LAST_RESPONSE = Platform.OS !== 'web';

export function PushRegistrar() {
  const { session } = useSession();
  const isAnonymous = useIsAnonymous();
  const userId = session?.user.id;

  useEffect(() => {
    // Un visiteur (session anonyme) ne peut ni avoir d'amis ni en recevoir :
    // rien à enregistrer, et une ligne de jeton à son nom disparaîtrait avec
    // sa session éphémère.
    if (!userId || isAnonymous) return;
    registerPushToken(userId);
  }, [userId, isAnonymous]);

  return CAN_READ_LAST_RESPONSE ? <NotificationRouter userId={userId} /> : null;
}

function NotificationRouter({ userId }: { userId: string | undefined }) {
  const queryClient = useQueryClient();
  // Renvoie aussi la notification qui a DEMARRE l'app depuis un état fermé,
  // pas seulement celles reçues app ouverte — c'est justement le cas le plus
  // fréquent pour une demande d'ami.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseId = useRef<string | null>(null);

  useEffect(() => {
    if (!lastResponse) return;

    // Sans cette garde, le même appui rejouerait la navigation à chaque
    // rendu : le hook retourne toujours la DERNIERE réponse, indéfiniment.
    const id = lastResponse.notification.request.identifier;
    if (handledResponseId.current === id) return;
    handledResponseId.current = id;

    // Tant que personne n'est connecté, la navigation serait de toute façon
    // renvoyée vers l'écran de connexion par la garde de session.
    if (!userId) return;

    // Recharger AVANT de naviguer, sinon l'écran s'ouvre sur le cache : la
    // demande d'ami qui vient d'être annoncée par la notification n'y figure
    // pas encore, et l'utilisateur arrive sur une liste qui dément ce qu'il
    // vient de lire. Le retour au premier plan suffit dans la plupart des
    // cas, mais pas quand l'app était DÉJÀ ouverte au moment de l'appui.
    queryClient.invalidateQueries({ queryKey: ['friendships'] });
    queryClient.invalidateQueries({ queryKey: ['habitationShares'] });

    const url = lastResponse.notification.request.content.data?.url;
    if (typeof url === 'string' && ALLOWED_ROUTES.has(url)) router.push(url);
    // `queryClient` est une référence stable, mais le lister évite qu'une
    // relecture future prenne son absence pour un oubli.
  }, [lastResponse, userId, queryClient]);

  return null;
}
