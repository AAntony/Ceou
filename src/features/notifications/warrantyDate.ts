// QUAND PRÉVENIR QU'UNE GARANTIE SE TERMINE.
//
// Isolé du reste pour être éprouvable : ce sont quelques lignes d'arithmétique
// de calendrier, c'est-à-dire l'endroit exact où l'on se trompe — d'un jour,
// d'un fuseau, ou d'un cas limite qu'on ne rencontre qu'en production. Rien
// ici ne touche aux notifications ni à React.

// UN MOIS AVANT, ET PAS LE JOUR MÊME — c'est la différence avec un prêt.
//
// « Ta perceuse devait revenir aujourd'hui » appelle une action le jour même.
// « Ta garantie se termine aujourd'hui » n'appelle plus rien : il est trop
// tard pour faire jouer quoi que ce soit. Un mois laisse le temps de
// constater une panne, de retrouver le ticket et de prendre rendez-vous.
export const LEAD_DAYS = 30;

/** 9 h locales, comme les autres rappels de l'app. */
export const REMINDER_HOUR = 9;

/**
 * Le premier 9 h strictement à venir.
 *
 * Il sert de PLANCHER : une garantie qui se termine dans dix jours a son
 * repère à un mois déjà derrière nous, et sans plancher elle ne produirait
 * aucun rappel — précisément dans le cas où il est le plus utile. Elle est
 * donc annoncée au prochain matin.
 */
export function prochainMatin(maintenant: Date): Date {
  const at = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
    REMINDER_HOUR,
    0,
    0,
    0,
  );
  if (at.getTime() <= maintenant.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Découpe une date seule au format ISO, EN HEURE LOCALE.
 *
 * Et surtout pas `new Date(iso)` : une date seule y est interprétée en UTC,
 * si bien que « 2027-03-12 » devient minuit UTC — soit la veille au soir pour
 * qui est à l'ouest. Le rappel tomberait un jour trop tôt, et le dernier jour
 * de garantie basculerait à tort dans le passé.
 */
export function jourLocal(iso: string, heure = 0): Date | null {
  const [annee, mois, jour] = iso.split('-').map(Number);
  if (!annee || !mois || !jour) return null;
  const date = new Date(annee, mois - 1, jour, heure, 0, 0, 0);
  // Une date impossible (31 février) déborde sur le mois suivant plutôt que
  // d'échouer : on la refuse par aller-retour, comme le fait déjà la saisie.
  if (date.getMonth() !== mois - 1 || date.getDate() !== jour) return null;
  return date;
}

/**
 * L'instant du rappel, ou `null` s'il n'y a plus rien à annoncer.
 *
 * `maintenant` est passé plutôt que lu : c'est ce qui rend la fonction
 * vérifiable sur des cas limites qu'on ne pourrait pas atteindre autrement.
 */
export function warrantyReminderDate(warrantyUntil: string | null, maintenant: Date): Date | null {
  if (!warrantyUntil) return null;

  const fin = jourLocal(warrantyUntil, REMINDER_HOUR);
  if (!fin) return null;

  const vise = new Date(fin.getTime());
  vise.setDate(vise.getDate() - LEAD_DAYS);

  const plancher = prochainMatin(maintenant);
  const at = vise.getTime() > plancher.getTime() ? vise : plancher;

  // Garantie déjà finie, ou qui se termine avant le prochain matin : il n'y a
  // plus rien à annoncer. C'est l'appareil qui programme, donc c'est lui qui
  // tranche, avec l'heure qu'il a réellement.
  if (at.getTime() > fin.getTime()) return null;
  return at;
}
