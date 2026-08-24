// Masquer un mot de passe SOI-MÊME, pour pouvoir en dévoiler la dernière
// lettre le temps de la taper.
//
// `secureTextEntry` masque tout, tout le temps : le champ ne laisse jamais
// voir ce qu'on vient de frapper. C'est la première cause de mot de passe
// saisi de travers, et d'autant plus pour qui tape lentement ou sur un petit
// clavier. Toutes les applications qui traitent ce problème font la même
// chose : elles masquent elles-mêmes, et laissent la dernière lettre visible
// une seconde.
//
// Le champ affiche donc une chaîne de puces, et la vraie valeur vit à côté.
// Toute la difficulté est de retrouver ce que l'utilisateur a réellement tapé
// à partir de ce que le champ renvoie — et c'est ce que fait `applyMaskedEdit`.

export const MASK_CHARACTER = '•';

/** La valeur telle qu'elle s'affiche : des puces, sauf la lettre dévoilée. */
export function maskValue(value: string, revealIndex: number): string {
  let masked = '';
  for (let index = 0; index < value.length; index++) {
    masked += index === revealIndex ? value[index] : MASK_CHARACTER;
  }
  return masked;
}

export type MaskedEdit = {
  /** La vraie valeur après la frappe. */
  value: string;
  /** Position de la lettre à dévoiler, ou -1 s'il n'y a rien à montrer. */
  revealIndex: number;
};

/**
 * Reconstitue la vraie valeur à partir de ce que le champ vient de renvoyer.
 *
 * Le champ ne connaît que des puces. Une frappe produit donc une chaîne où
 * seuls les caractères NOUVEAUX sont réels, les autres restant des puces —
 * il faut les remplacer par ce qu'ils cachaient.
 *
 * La reconstitution se fait par alignement : on repère ce qui n'a pas bougé
 * au début et à la fin, et tout ce qui reste au milieu est ce qui vient
 * d'être inséré. Ça couvre la frappe, l'effacement, le collage et le
 * remplacement d'une sélection — n'importe quelle modification d'un seul
 * tenant, ce qu'est toujours une frappe.
 *
 * On ne dévoile que si l'insertion se termine À LA FIN de la valeur. Éclairer
 * un caractère au milieu, en pleine correction, attirerait l'œil là où il
 * n'a rien à faire.
 *
 * LIMITE ASSUMÉE : un effacement au MILIEU retire le dernier caractère plutôt
 * que celui visé. Les puces étant toutes identiques, rien dans ce que renvoie
 * le champ ne dit LAQUELLE a disparu — l'information n'existe pas, aucun
 * algorithme ne la retrouvera. La longueur affichée reste juste, et les trois
 * écrans concernés rattrapent l'erreur immédiatement : à l'inscription et au
 * changement de mot de passe, un second champ doit correspondre ; à la
 * connexion, le serveur refuse. Rien ne se perd en silence.
 */
export function applyMaskedEdit(displayed: string, next: string, value: string): MaskedEdit {
  let prefix = 0;
  while (prefix < next.length && prefix < displayed.length && next[prefix] === displayed[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < next.length - prefix &&
    suffix < displayed.length - prefix &&
    next[next.length - 1 - suffix] === displayed[displayed.length - 1 - suffix]
  ) {
    suffix++;
  }

  const inserted = next.slice(prefix, next.length - suffix);
  const nextValue = value.slice(0, prefix) + inserted + value.slice(value.length - suffix);

  return {
    value: nextValue,
    revealIndex: inserted.length > 0 && suffix === 0 ? nextValue.length - 1 : -1,
  };
}
