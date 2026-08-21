import * as Notifications from 'expo-notifications';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';
import { logClientError } from '../../lib/errorLogging';
import type { ShareInviteEntry } from '../sharing/queries';

/**
 * Le strict nécessaire pour décider et rédiger un rappel. Volontairement
 * plus étroit que ShareInviteEntry : la modale de création ne connaît que la
 * ligne renvoyée par le serveur, pas l'entrée enrichie de l'écran de gestion.
 */
export type ReminderTarget = Pick<
  ShareInviteEntry,
  'id' | 'code' | 'label' | 'habitationNames' | 'maxUses' | 'useCount' | 'expiresAt' | 'remindDaysBefore'
>;

// Rappel « ton code d'invitation expire bientôt ».
//
// NOTIFICATION LOCALE, pas un envoi serveur, et c'est le choix central de ce
// fichier. Le rappel concerne le CREATEUR du code, à propos de SON code, et
// la date d'expiration est connue dès la création : il n'y a donc rien à
// décider côté serveur le jour venu. Le programmer sur l'appareil évite
// entièrement une tâche planifiée en base et la clé de service qu'il aurait
// fallu y stocker pour qu'elle puisse sortir vers Expo.
//
// Contrepartie assumée : le rappel arrive sur l'appareil où le code a été
// créé, pas sur tous ceux de la personne.

const IDENTIFIER_PREFIX = 'invite-reminder-';

function identifierFor(inviteId: string): string {
  return `${IDENTIFIER_PREFIX}${inviteId}`;
}

/**
 * Délai de rappel proposé pour une durée de vie donnée, en jours.
 *
 * Proportionnel plutôt que fixe : un code de 2 jours et un code d'un an ne
 * peuvent pas partager le même préavis. Un cinquième de la durée, jamais
 * moins d'un jour ni plus d'une semaine — au-delà, « bientôt » ne veut plus
 * rien dire.
 */
export function defaultReminderDays(durationDays: number): number {
  return Math.max(1, Math.min(7, Math.round(durationDays * 0.2)));
}

/** Instant du rappel, ou `null` si ce code n'en mérite aucun. */
function reminderDateFor(entry: ReminderTarget): Date | null {
  if (!entry.expiresAt || !entry.remindDaysBefore) return null;

  // Un code déjà épuisé ou déjà expiré n'a plus rien à annoncer. Le serveur
  // ne fait pas ce tri : c'est l'appareil qui programme, donc c'est lui qui
  // tranche, avec l'heure qu'il a réellement.
  if (entry.maxUses !== null && entry.useCount >= entry.maxUses) return null;

  const expiry = new Date(entry.expiresAt).getTime();
  const at = new Date(expiry - entry.remindDaysBefore * 24 * 60 * 60 * 1000);
  // Préavis plus long que ce qu'il reste à vivre au code : le rappel serait
  // déjà en retard au moment de le poser.
  if (at.getTime() <= Date.now()) return null;
  return at;
}

function describe(entry: ReminderTarget): string {
  // Le libellé d'abord (« Locataires juillet »), sinon les Habitations
  // concernées, sinon le code lui-même — il en reste toujours quelque chose
  // à montrer.
  if (entry.label) return entry.label;
  if (entry.habitationNames.length > 0) return entry.habitationNames.join(', ');
  return entry.code;
}

async function scheduleOne(entry: ReminderTarget, at: Date, t: TFunction): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    // Identifiant déterministe : reprogrammer le même code REMPLACE son
    // rappel au lieu d'en empiler un second. C'est ce qui rend la
    // réconciliation ci-dessous sûre à relancer autant de fois qu'on veut.
    identifier: identifierFor(entry.id),
    content: {
      title: t('invites.reminder.title'),
      body: t('invites.reminder.body', { name: describe(entry), count: entry.remindDaysBefore ?? 1 }),
      data: { kind: 'invite_expiry', inviteId: entry.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

/**
 * Aligne les rappels programmés sur l'appareil avec la liste réelle des
 * codes.
 *
 * Réconciliation complète plutôt qu'une pose à la création : un code peut
 * être renouvelé (nouvelle date), supprimé, ou épuisé entre-temps, et une
 * réinstallation efface tous les rappels programmés. Repartir de la liste à
 * chaque fois évite d'avoir à traiter chacun de ces cas séparément.
 */
export async function syncInviteReminders(entries: ReminderTarget[], t: TFunction): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    // On ne DEMANDE pas l'autorisation ici : elle est demandée une fois à la
    // connexion. Ouvrir l'écran des codes n'est pas le bon moment pour faire
    // surgir une boîte système.
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    const wanted = new Map<string, Date>();
    for (const entry of entries) {
      const at = reminderDateFor(entry);
      if (at) wanted.set(entry.id, at);
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (!request.identifier.startsWith(IDENTIFIER_PREFIX)) continue;
      const inviteId = request.identifier.slice(IDENTIFIER_PREFIX.length);
      // Code disparu, épuisé ou expiré depuis la dernière visite.
      if (!wanted.has(inviteId)) await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }

    for (const entry of entries) {
      const at = wanted.get(entry.id);
      // Repose systématiquement ceux qui doivent exister, sans chercher à
      // savoir lesquels ont bougé : l'identifiant déterministe fait que
      // reposer un rappel inchangé le réécrit à l'identique.
      if (at) await scheduleOne(entry, at, t);
    }
  } catch (error) {
    logClientError(error, { source: 'invite_reminders_sync' });
  }
}

/**
 * Pose le rappel d'un code qui vient d'être créé.
 *
 * Doublon apparent avec la réconciliation, mais nécessaire : un code se crée
 * depuis le Profil, et rien n'oblige à passer ensuite par l'écran de gestion
 * des codes — sans ça, le rappel n'existerait qu'au prochain détour par cet
 * écran.
 */
export async function scheduleInviteReminder(entry: ReminderTarget, t: TFunction): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const at = reminderDateFor(entry);
    if (!at) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await scheduleOne(entry, at, t);
  } catch (error) {
    logClientError(error, { source: 'invite_reminder_schedule' });
  }
}

/**
 * Retire tous les rappels de cet appareil — à la déconnexion.
 *
 * Sans ça, le rappel d'un code du compte précédent surgirait chez la
 * personne suivante, en nommant une Habitation qui ne la concerne pas.
 */
export async function cancelAllInviteReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.identifier.startsWith(IDENTIFIER_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
  } catch (error) {
    logClientError(error, { source: 'invite_reminders_cancel' });
  }
}
