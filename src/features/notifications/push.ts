import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logClientError } from '../../lib/errorLogging';
import { supabase } from '../../lib/supabase/client';

// Enregistrement de l'appareil auprès du service Expo Push.
//
// Ce fichier ne contient AUCUN texte de notification : il ne fait qu'obtenir
// un jeton et le déposer en base. Le texte, lui, est composé côté serveur
// dans la langue du destinataire (voir supabase/functions/send-push) — au
// moment où une notification arrive, l'app n'est pas forcément lancée, elle
// n'a rien à traduire.

const ANDROID_CHANNEL_ID = 'default';

// Le jeton obtenu au démarrage, gardé en mémoire pour pouvoir supprimer LA
// BONNE ligne à la déconnexion. Le relire depuis la base ne marcherait pas :
// à ce moment-là, la session est déjà en train de tomber.
let currentToken: string | null = null;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

// Affichage quand l'app est déjà au premier plan. Sans ce réglage, une
// notification reçue pendant qu'on utilise l'app n'apparaît nulle part —
// comportement par défaut d'Android, déroutant en test comme en usage réel.
export function installNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  // Canal déclaré explicitement plutôt que laissé au canal implicite : c'est
  // lui qui décide de l'importance (bandeau + son), et l'utilisateur peut le
  // régler finement depuis les paramètres système. Son identifiant doit
  // correspondre au `channelId` envoyé par la fonction send-push.
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Céoù',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1591EA',
  });
}

/**
 * Demande l'autorisation si besoin, récupère le jeton Expo de cet appareil
 * et l'associe au compte connecté.
 *
 * Silencieuse par conception : un refus d'autorisation n'est pas une erreur,
 * c'est un choix. On ne relance jamais la demande de nous-mêmes (Android ne
 * réaffiche de toute façon plus la boîte système après un refus) — l'ancrage
 * pour changer d'avis reste les paramètres du téléphone.
 */
export async function registerPushToken(userId: string): Promise<void> {
  // Le web a besoin d'une configuration VAPID que ce projet n'a pas, et
  // l'app cible le mobile — on s'arrête avant de tenter quoi que ce soit.
  if (Platform.OS === 'web') return;

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return;

    const id = projectId();
    if (!id) return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    currentToken = token;

    // `onConflict: 'token'` — la clé primaire est le jeton, donc reconnecter
    // un autre compte sur le même téléphone réaffecte la ligne au lieu d'en
    // créer une deuxième. Voir la migration push_tokens.
    const { error } = await supabase.from('push_tokens').upsert(
      {
        token,
        user_id: userId,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    if (error) throw error;
  } catch (error) {
    // Un émulateur sans services Google, un mode avion, un projet EAS mal
    // configuré : rien de tout cela ne doit empêcher l'app de démarrer.
    logClientError(error, { source: 'push_register' });
  }
}

/**
 * Détache cet appareil du compte qui se déconnecte.
 *
 * À appeler AVANT `signOut()` : la suppression passe par la RLS
 * (`user_id = auth.uid()`), donc elle échouerait une fois la session partie.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!currentToken) return;
  const token = currentToken;
  currentToken = null;
  try {
    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) throw error;
  } catch (error) {
    logClientError(error, { source: 'push_unregister' });
  }
}

export type PushEvent = 'friend_request' | 'friend_accepted';

/**
 * Demande au serveur de notifier l'autre partie d'une relation d'amitié.
 *
 * Volontairement « au mieux » : on n'attend pas le résultat pour continuer,
 * et un échec ne remonte jamais à l'utilisateur. Sa demande d'ami, elle, est
 * déjà enregistrée — lui afficher une erreur parce qu'une notification n'est
 * pas partie donnerait à croire que l'action a échoué.
 */
export function notifyFriendEvent(event: PushEvent, friendshipId: string): void {
  supabase.functions
    .invoke('send-push', { body: { event, friendshipId } })
    .catch((error) => logClientError(error, { source: 'push_notify' }));
}
