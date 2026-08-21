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

export function PushRegistrar() {
  const { session } = useSession();
  const isAnonymous = useIsAnonymous();
  const userId = session?.user.id;

  // Renvoie aussi la notification qui a DEMARRE l'app depuis un état fermé,
  // pas seulement celles reçues app ouverte — c'est justement le cas le plus
  // fréquent pour une demande d'ami.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseId = useRef<string | null>(null);

  useEffect(() => {
    // Un visiteur (session anonyme) ne peut ni avoir d'amis ni en recevoir :
    // rien à enregistrer, et une ligne de jeton à son nom disparaîtrait avec
    // sa session éphémère.
    if (!userId || isAnonymous) return;
    registerPushToken(userId);
  }, [userId, isAnonymous]);

  useEffect(() => {
    if (Platform.OS === 'web' || !lastResponse) return;

    // Sans cette garde, le même appui rejouerait la navigation à chaque
    // rendu : le hook retourne toujours la DERNIERE réponse, indéfiniment.
    const id = lastResponse.notification.request.identifier;
    if (handledResponseId.current === id) return;
    handledResponseId.current = id;

    // Tant que personne n'est connecté, la navigation serait de toute façon
    // renvoyée vers l'écran de connexion par la garde de session.
    if (!userId) return;

    const url = lastResponse.notification.request.content.data?.url;
    if (typeof url === 'string' && ALLOWED_ROUTES.has(url)) router.push(url);
  }, [lastResponse, userId]);

  return null;
}
