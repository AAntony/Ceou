import * as Notifications from 'expo-notifications';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';
import { logClientError } from '../../lib/errorLogging';

/**
 * Le strict nécessaire pour décider et rédiger un rappel de prêt.
 *
 * Volontairement AUTONOME, sans importer les types de loans/queries : ce
 * module est appelé DEPUIS la couche de données (à la clôture d'un prêt), et
 * un import croisé entre les deux ferait un cycle. `PretEntry` satisfait
 * cette forme structurellement, la feuille de création la fabrique à partir
 * de la ligne insérée.
 */
export type LoanReminderTarget = {
  id: string;
  objetName: string;
  direction: 'pret' | 'emprunt';
  counterpartLabel: string;
  dueAt: string | null;
  returnedAt: string | null;
};

// Rappel « cet objet devait revenir aujourd'hui ».
//
// NOTIFICATION LOCALE, même choix et mêmes raisons que pour les codes
// d'invitation (voir inviteReminders) : le rappel concerne la personne qui a
// enregistré le prêt, à propos de SON prêt, et l'échéance est connue dès la
// création. Rien à décider côté serveur le jour venu, donc ni tâche planifiée
// ni clé de service à stocker en base.
//
// Contrepartie assumée, identique : le rappel arrive sur l'appareil où le
// prêt a été enregistré, pas sur tous ceux de la personne.

const IDENTIFIER_PREFIX = 'loan-reminder-';

// 9 h locales. L'échéance porte l'heure à laquelle le prêt a été enregistré —
// « dans 14 jours » à 2 h du matin échoit à 2 h du matin. Sonner à ce
// moment-là serait absurde, donc le rappel est ramené à une heure civile le
// jour de l'échéance.
const REMINDER_HOUR = 9;

function identifierFor(pretId: string): string {
  return `${IDENTIFIER_PREFIX}${pretId}`;
}

/**
 * Instant du rappel, ou `null` si ce prêt n'en mérite aucun.
 *
 * LE JOUR DE L'ÉCHÉANCE, PAS LA VEILLE. Un code d'invitation se renouvelle
 * avant d'expirer, donc on prévient en avance ; un prêt, lui, ne demande rien
 * tant que la date n'est pas là. « Ta perceuse devait revenir aujourd'hui »
 * appelle un message à Marc ; « elle revient demain » n'appelle rien.
 */
function reminderDateFor(entry: LoanReminderTarget): Date | null {
  if (!entry.dueAt || entry.returnedAt) return null;

  const due = new Date(entry.dueAt);
  const at = new Date(due.getFullYear(), due.getMonth(), due.getDate(), REMINDER_HOUR, 0, 0, 0);

  // Échéance du jour même passée 9 h, ou déjà en retard : le rappel serait
  // posé dans le passé. C'est l'appareil qui programme, donc c'est lui qui
  // tranche, avec l'heure qu'il a réellement.
  if (at.getTime() <= Date.now()) return null;
  return at;
}

async function scheduleOne(entry: LoanReminderTarget, at: Date, t: TFunction): Promise<void> {
  const lent = entry.direction === 'pret';
  await Notifications.scheduleNotificationAsync({
    // Identifiant déterministe : reprogrammer le même prêt REMPLACE son
    // rappel au lieu d'en empiler un second. C'est ce qui rend la
    // réconciliation ci-dessous sûre à relancer autant de fois qu'on veut.
    identifier: identifierFor(entry.id),
    content: {
      title: t(lent ? 'loans.reminder.title_lent' : 'loans.reminder.title_borrowed'),
      body: t(lent ? 'loans.reminder.body_lent' : 'loans.reminder.body_borrowed', {
        objet: entry.objetName,
        name: entry.counterpartLabel,
      }),
      // `url` est ce que lit PushRegistrar pour naviguer à l'appui — sans
      // lui, la notification s'ouvre sur l'écran d'accueil et laisse chercher.
      data: { kind: 'loan_due', pretId: entry.id, url: '/prets' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

/**
 * Aligne les rappels programmés sur l'appareil avec la liste réelle des prêts.
 *
 * Réconciliation complète plutôt qu'une simple pose à la création : un prêt
 * peut avoir été rendu depuis un autre appareil, supprimé, ou l'app
 * réinstallée — ce qui efface tous les rappels programmés. Repartir de la
 * liste évite d'avoir à traiter chacun de ces cas séparément.
 */
export async function syncLoanReminders(entries: LoanReminderTarget[], t: TFunction): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    // On ne DEMANDE pas l'autorisation ici : elle est demandée une fois à la
    // connexion. Ouvrir l'écran des prêts n'est pas le bon moment pour faire
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
      const pretId = request.identifier.slice(IDENTIFIER_PREFIX.length);
      // Prêt rendu, supprimé ou échu depuis la dernière visite.
      if (!wanted.has(pretId)) await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }

    for (const entry of entries) {
      const at = wanted.get(entry.id);
      // Repose systématiquement ceux qui doivent exister : l'identifiant
      // déterministe fait que reposer un rappel inchangé le réécrit à
      // l'identique.
      if (at) await scheduleOne(entry, at, t);
    }
  } catch (error) {
    logClientError(error, { source: 'loan_reminders_sync' });
  }
}

/**
 * Pose le rappel d'un prêt qui vient d'être enregistré.
 *
 * Doublon apparent avec la réconciliation, mais nécessaire : un prêt
 * s'enregistre depuis la fiche d'un objet, et rien n'oblige à passer ensuite
 * par l'écran des prêts — sans ça, le rappel n'existerait qu'au prochain
 * détour par cet écran.
 */
export async function scheduleLoanReminder(entry: LoanReminderTarget, t: TFunction): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const at = reminderDateFor(entry);
    if (!at) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await scheduleOne(entry, at, t);
  } catch (error) {
    logClientError(error, { source: 'loan_reminder_schedule' });
  }
}

/**
 * Retire le rappel d'un prêt clos ou supprimé.
 *
 * Appelé depuis la mutation elle-même et non depuis un écran : on clôt un
 * prêt aussi bien depuis la fiche de l'objet que depuis la liste, et le
 * rappel ne doit survivre ni à l'un ni à l'autre. Sans ça, le téléphone
 * annoncerait le retour d'un objet déjà revenu.
 */
export async function cancelLoanReminder(pretId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifierFor(pretId));
  } catch (error) {
    logClientError(error, { source: 'loan_reminder_cancel' });
  }
}

/**
 * Retire tous les rappels de prêt de cet appareil — à la déconnexion.
 *
 * Même raison que pour les codes d'invitation : sans ce ménage, le rappel du
 * compte précédent surgirait chez la personne suivante, en nommant un objet
 * qui ne lui appartient pas.
 */
export async function cancelAllLoanReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.identifier.startsWith(IDENTIFIER_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
  } catch (error) {
    logClientError(error, { source: 'loan_reminders_cancel' });
  }
}
