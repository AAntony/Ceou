import * as Notifications from 'expo-notifications';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';
import { logClientError } from '../../lib/errorLogging';
import { jourLocal, warrantyReminderDate } from './warrantyDate';

/**
 * Le strict nécessaire pour décider et rédiger un rappel de garantie.
 *
 * Volontairement AUTONOME, sans importer les types de factures/queries : ce
 * module est appelé DEPUIS la couche de données (à l'enregistrement d'une
 * facture), et un import croisé entre les deux ferait un cycle. Même montage
 * que loanReminders, pour la même raison.
 */
export type WarrantyReminderTarget = {
  /**
   * L'identifiant de la LIAISON facture/objet, et non de la facture.
   *
   * UN RAPPEL PAR LIGNE, parce que la garantie est par ligne : deux objets du
   * meme ticket de caisse n'ont pas la meme duree — deux ans pour un frigo, un
   * an pour un grille-pain. Un seul rappel pour les deux serait faux pour l'un
   * des deux, et on ne saurait pas lequel.
   */
  id: string;
  /** L'objet dont on parle. */
  objet: string;
  warrantyUntil: string | null;
  /** Où renvoyer à l'appui sur la notification. */
  habitationId: string | null;
};

// ═══ « TA GARANTIE SE TERMINE DANS UN MOIS » ═══
//
// C'EST CE RAPPEL QUI FAIT VIVRE LES FACTURES. Sans lui, on ne rouvre son
// dossier qu'après un sinistre — donc presque jamais, donc on renonce à le
// remplir. La date de fin de garantie était déjà saisissable et ne produisait
// qu'une pastille « Sous garantie » que personne n'allait regarder : une
// information vraie, posée là où on ne passe pas.
//
// NOTIFICATION LOCALE, même choix et mêmes raisons que les prêts et les codes
// d'invitation : le rappel concerne la personne qui a saisi la facture, à
// propos de SA facture, et l'échéance est connue dès la saisie. Rien à
// décider côté serveur le jour venu, donc ni tâche planifiée ni clé de
// service. Contrepartie assumée, identique : le rappel arrive sur l'appareil
// où la facture a été enregistrée, pas sur tous ceux de la personne.

const IDENTIFIER_PREFIX = 'warranty-reminder-';

function identifierFor(ligneId: string): string {
  return `${IDENTIFIER_PREFIX}${ligneId}`;
}

/** Instant du rappel, ou `null` si cette facture n'en mérite aucun. */
function reminderDateFor(entry: WarrantyReminderTarget): Date | null {
  return warrantyReminderDate(entry.warrantyUntil, new Date());
}


async function scheduleOne(
  entry: WarrantyReminderTarget,
  at: Date,
  fin: string,
  t: TFunction,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    // Identifiant déterministe : reprogrammer la même facture REMPLACE son
    // rappel au lieu d'en empiler un second. C'est ce qui rend la
    // réconciliation ci-dessous sûre à relancer autant de fois qu'on veut.
    identifier: identifierFor(entry.id),
    content: {
      title: t('factures.warranty.title'),
      body: t('factures.warranty.body', { objet: entry.objet || t('factures.block.untitled'), date: fin }),
      // PAS D'ADRESSE DANS LA CHARGE UTILE, juste de quoi en construire une.
      //
      // PushRegistrar ne navigue que vers des routes qu'il connaît lui-même —
      // « une charge utile n'est pas une instruction de navigation ». Les
      // rappels de prêt peuvent donc y poser `/prets`, qui est fixe ; le
      // dossier d'un logement, lui, porte un identifiant, et une liste
      // blanche ne peut pas le prévoir. C'est donc PushRegistrar qui assemble
      // la route, à partir de ce `kind` et de cet identifiant : le nom de
      // l'écran reste écrit dans le code de l'app, jamais dans le message.
      data: { kind: 'warranty_ending', ligneId: entry.id, habitationId: entry.habitationId },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

/** La date de fin telle qu'on l'écrit dans le message. */
function formaterFin(iso: string, langue: string): string {
  return jourLocal(iso)?.toLocaleDateString(langue) ?? iso;
}

/**
 * Aligne les rappels programmés sur l'appareil avec les factures d'un logement.
 *
 * Réconciliation complète plutôt qu'une simple pose à la saisie : une date de
 * garantie peut avoir été corrigée depuis un autre appareil, la facture
 * supprimée, ou l'app réinstallée — ce qui efface tout ce qui était
 * programmé. Repartir de la liste évite d'avoir à traiter chacun de ces cas.
 *
 * PORTÉE À UN LOGEMENT, et c'est la limite de ce montage : elle ne nettoie
 * que les rappels des factures qu'elle voit. Un rappel dont la facture a
 * disparu d'un AUTRE logement survivrait jusqu'à ce qu'on ouvre le dossier de
 * celui-là. La suppression, elle, annule directement (voir plus bas) : le cas
 * qui resterait est celui d'une suppression faite depuis un autre appareil.
 */
export async function syncWarrantyReminders(
  entries: WarrantyReminderTarget[],
  t: TFunction,
  langue: string,
): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    // On ne DEMANDE pas l'autorisation ici : elle est demandée une fois à la
    // connexion. Ouvrir un dossier de factures n'est pas le bon moment pour
    // faire surgir une boîte système.
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    const vus = new Set(entries.map((entry) => entry.id));
    const voulus = new Map<string, Date>();
    for (const entry of entries) {
      const at = reminderDateFor(entry);
      if (at) voulus.set(entry.id, at);
    }

    const programmes = await Notifications.getAllScheduledNotificationsAsync();
    for (const demande of programmes) {
      if (!demande.identifier.startsWith(IDENTIFIER_PREFIX)) continue;
      const ligneId = demande.identifier.slice(IDENTIFIER_PREFIX.length);
      // SEULEMENT CE QUE CETTE LISTE COUVRE. Annuler tout ce qui n'y figure
      // pas effacerait les rappels des autres logements à chaque visite.
      if (!vus.has(ligneId)) continue;
      if (!voulus.has(ligneId)) await Notifications.cancelScheduledNotificationAsync(demande.identifier);
    }

    for (const entry of entries) {
      const at = voulus.get(entry.id);
      // Repose systématiquement ceux qui doivent exister : l'identifiant
      // déterministe fait que reposer un rappel inchangé le réécrit à
      // l'identique.
      if (at && entry.warrantyUntil) await scheduleOne(entry, at, formaterFin(entry.warrantyUntil, langue), t);
    }
  } catch (error) {
    logClientError(error, { source: 'warranty_reminders_sync' });
  }
}

/**
 * Pose le rappel d'une facture qu'on vient d'enregistrer ou de corriger.
 *
 * Doublon apparent avec la réconciliation, mais nécessaire : une facture
 * s'ajoute depuis la fiche d'un objet, et rien n'oblige à passer ensuite par
 * le dossier du logement — sans ça, le rappel n'existerait qu'au prochain
 * détour par cet écran. Une date corrigée doit de même valoir tout de suite.
 */
export async function scheduleWarrantyReminder(
  entry: WarrantyReminderTarget,
  t: TFunction,
  langue: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    const at = reminderDateFor(entry);
    // PAS DE DATE, OU PLUS RIEN À ANNONCER : on RETIRE. C'est le cas d'une
    // garantie effacée à la correction — sans ça, le téléphone continuerait
    // d'annoncer une échéance que la facture ne porte plus.
    if (!at || !entry.warrantyUntil) {
      await Notifications.cancelScheduledNotificationAsync(identifierFor(entry.id));
      return;
    }
    await scheduleOne(entry, at, formaterFin(entry.warrantyUntil, langue), t);
  } catch (error) {
    logClientError(error, { source: 'warranty_reminder_schedule' });
  }
}

/**
 * Retire le rappel d'une facture supprimée.
 *
 * Appelé depuis la mutation elle-même et non depuis un écran : on supprime
 * une facture aussi bien depuis la fiche d'un objet que depuis le dossier, et
 * le rappel ne doit survivre ni à l'un ni à l'autre.
 */
export async function cancelWarrantyReminder(ligneId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifierFor(ligneId));
  } catch (error) {
    logClientError(error, { source: 'warranty_reminder_cancel' });
  }
}

/**
 * Retire tous les rappels de garantie de cet appareil — à la déconnexion.
 *
 * Même raison que pour les prêts et les codes d'invitation : sans ce ménage,
 * le rappel du compte précédent surgirait chez la personne suivante, en
 * nommant un objet qui ne lui appartient pas.
 */
export async function cancelAllWarrantyReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const programmes = await Notifications.getAllScheduledNotificationsAsync();
    for (const demande of programmes) {
      if (demande.identifier.startsWith(IDENTIFIER_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(demande.identifier);
      }
    }
  } catch (error) {
    logClientError(error, { source: 'warranty_reminders_cancel' });
  }
}
