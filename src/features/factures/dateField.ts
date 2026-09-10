// SAISIR UNE DATE SANS SÉLECTEUR NATIF.
//
// L'app n'embarque pas de sélecteur de date, et en ajouter un demanderait un
// module natif — donc un build, donc plus de vérification par mise à jour
// à distance. Pour une fonctionnalité qu'on veut éprouver vite, c'est cher.
//
// Un champ assisté fait l'affaire : clavier numérique, séparateurs posés au
// fil de la frappe, et la date rendue au format que la base attend. Le jour
// où un sélecteur natif arrive, il écrira la même valeur — les données ne
// bougeront pas.
//
// L'ORDRE DES NOMBRES SUIT LA LANGUE, et ce n'est pas un détail : un
// francophone qui tape 03/04 veut le 3 avril, un anglophone le 4 mars.
// Deviner de travers ne se remarque qu'à la relecture, des mois plus tard,
// sur une facture dont la date de garantie compte.

export type DateOrder = 'dmy' | 'mdy';

/** L'ordre attendu pour une langue. */
export function dateOrderFor(language: string): DateOrder {
  return language.startsWith('en') ? 'mdy' : 'dmy';
}

/** Ce qu'on affiche sous le champ pour dire quoi taper. */
export function datePlaceholder(order: DateOrder): string {
  return order === 'mdy' ? 'MM/DD/YYYY' : 'JJ/MM/AAAA';
}

/**
 * Ce que le champ doit montrer après cette frappe.
 *
 * On ne garde que les chiffres et on repose les barres soi-même : ça rend
 * l'effacement naturel — retirer une barre revient à retirer le chiffre qui
 * la précède, ce qui est ce que la personne veut.
 */
export function formatDateInput(raw: string): string {
  const chiffres = raw.replace(/\D/g, '').slice(0, 8);
  if (chiffres.length <= 2) return chiffres;
  if (chiffres.length <= 4) return `${chiffres.slice(0, 2)}/${chiffres.slice(2)}`;
  return `${chiffres.slice(0, 2)}/${chiffres.slice(2, 4)}/${chiffres.slice(4)}`;
}

/**
 * La date au format de la base, ou `null` si la saisie n'en désigne aucune.
 *
 * `null` couvre DEUX cas volontairement confondus : le champ vide, et une
 * saisie en cours ou impossible. L'appelant n'a pas à les distinguer — dans
 * les deux cas il n'y a rien à enregistrer. C'est `isDateIncomplete` qui sert
 * à prévenir la personne, et seulement quand elle a fini.
 */
export function toIsoDate(display: string, order: DateOrder): string | null {
  const parties = display.split('/');
  if (parties.length !== 3) return null;
  if (parties[0].length !== 2 || parties[1].length !== 2 || parties[2].length !== 4) return null;

  const [premier, second, annee] = parties.map(Number);
  if (!Number.isFinite(premier) || !Number.isFinite(second) || !Number.isFinite(annee)) return null;

  const jour = order === 'mdy' ? second : premier;
  const mois = order === 'mdy' ? premier : second;

  // LE 31 FÉVRIER DOIT ÊTRE REFUSÉ, et une simple comparaison de bornes ne
  // suffit pas. On construit la date puis on vérifie qu'elle a bien gardé les
  // trois nombres : JavaScript reporte silencieusement un jour de trop sur le
  // mois suivant, et on enregistrerait le 2 mars pour un 31 février saisi.
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/** Une saisie commencée mais qui ne désigne pas de date. */
export function isDateIncomplete(display: string, order: DateOrder): boolean {
  return display.length > 0 && toIsoDate(display, order) === null;
}

/** Le chemin inverse : ce que la base contient, tel qu'on l'affiche. */
export function fromIsoDate(iso: string | null, order: DateOrder): string {
  if (!iso) return '';
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  if (!annee || !mois || !jour) return '';
  return order === 'mdy' ? `${mois}/${jour}/${annee}` : `${jour}/${mois}/${annee}`;
}
