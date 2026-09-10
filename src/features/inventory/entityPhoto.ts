// LA RÈGLE VIT DANS lib/images/media.ts, ET NULLE PART AILLEURS.
//
// « Fichier local » se distinguait ici par le préfixe http, et le module
// d'affichage posait exactement le même test de son côté. Deux copies d'une
// même règle sur la forme d'une valeur stockée, c'est une divergence en
// attente : le jour où cette forme change — buckets privés, adresses
// signées — une seule des deux serait corrigée, et l'app re-téléverserait
// en boucle des photos déjà envoyées.
import { isLocalUri, parseStoredMedia } from '../../lib/images/media';
import { uploadOp, type WriteOp, type WriteTable } from '../../lib/writeQueue';
import type { EntityLevel } from './placeholders';

// Photos d'Habitation / Pièce / Emplacement / Conteneur.
//
// BUCKET RÉUTILISÉ, délibérément. Tout part dans `objets`, le bucket qui
// existe déjà, sous un chemin `<uid>/<niveau>-<id>.jpg`. Un bucket par
// niveau aurait été plus joli à lire, mais aurait demandé de retoucher les
// policies de `storage.objects` — or ce sont exactement elles qui ont cassé
// l'envoi de photos le 19/08 (voir la migration restore_owner_storage_read).
// Le préfixe de dossier reste l'uid, donc la policy existante s'applique
// telle quelle, sans y toucher.
//
// ═══ PLUS DE TÉLÉVERSEMENT ICI : ON PLANIFIE, LA FILE EXÉCUTE ═══
//
// Ce module envoyait le fichier lui-même et rendait l'adresse obtenue, que
// l'écran écrivait ensuite. Sans réseau, l'envoi échouait et TOUT s'arrêtait
// là : ni la photo ni le renommage saisi en même temps n'étaient enregistrés,
// et rien n'était mis en file. C'est le défaut déjà corrigé sur l'objet, à
// l'identique sur les quatre autres niveaux.
//
// L'ordre est inversé : on garde le chemin LOCAL du fichier choisi, l'écran
// le montre tout de suite, et l'envoi part avec le reste de l'écriture — donc
// au retour du réseau s'il le faut. Le fichier est déjà sur l'appareil : il
// n'y a aucune raison d'attendre pour l'afficher.

/**
 * Ce que le formulaire a changé, en une valeur à trois états.
 *
 * `undefined` (pas touché), `null` (retirée) et une valeur (nouvelle photo)
 * doivent rester DISTINCTS : sans cette distinction, ouvrir une fiche pour
 * corriger un nom effacerait la photo au passage.
 *
 * Synchrone, désormais — c'est tout l'intérêt. L'écran n'a plus rien à
 * attendre, donc plus rien qui puisse échouer faute de réseau.
 */
export function photoChange(chosen: string | null, current: string | null): string | null | undefined {
  return chosen === current ? undefined : chosen;
}

export type EntityPhotoPlan = {
  /** À fondre dans le `patch` de l'écriture, quand il y a une colonne à poser. */
  column: { photo_url?: string | null };
  /** L'envoi du fichier, différé comme le reste. Vide s'il n'y a rien à envoyer. */
  ops: WriteOp[];
  /** Le chemin local à afficher en attendant l'adresse définitive. */
  localUri: string | null;
};

const NOTHING: EntityPhotoPlan = { column: {}, ops: [], localUri: null };

/**
 * Traduit le changement de photo en opérations pour la file d'écriture.
 *
 * LA COLONNE RESTE VIDE quand un fichier local est à envoyer, et ce n'est pas
 * un oubli : c'est l'opération `upload` qui écrira `photo_url`, une fois
 * l'adresse définitive connue. Y poser le chemin local d'abord laisserait un
 * `file://…` en base si le lot échouait juste après — une adresse qu'aucun
 * autre appareil ne saurait ouvrir, et que cette application prendrait
 * ensuite pour une photo « déjà enregistrée ».
 */
export function planEntityPhoto(params: {
  level: EntityLevel;
  table: WriteTable;
  entityId: string;
  userId: string;
  /** Le résultat de `photoChange`. */
  photo: string | null | undefined;
}): EntityPhotoPlan {
  const { level, table, entityId, userId, photo } = params;

  if (photo === undefined) return NOTHING;
  if (photo === null) return { column: { photo_url: null }, ops: [], localUri: null };

  // UNE ADRESSE QUI EST DÉJÀ LA NÔTRE NE SE RENVOIE PAS. C'est le cas d'une
  // fiche qu'on rouvre pour corriger un nom : la photo n'a pas bougé, son
  // fichier est en place, il n'y a rien à faire.
  //
  // TOUT LE RESTE PART DANS NOTRE BUCKET, y compris une adresse distante.
  // Le scan de code-barre en produit une — UPCItemDB rend la photo du
  // produit — et la ranger telle quelle en base ferait dépendre l'inventaire
  // d'un tiers : sa photo disparaîtrait le jour où il la retire, et il
  // saurait à chaque affichage qu'on la regarde. On la recopie, comme
  // avant.
  if (!isLocalUri(photo) && parseStoredMedia(photo) !== null) {
    return { column: { photo_url: photo }, ops: [], localUri: null };
  }

  return {
    column: {},
    ops: [
      uploadOp({
        uri: photo,
        bucket: 'objets',
        // MÊME CHEMIN QU'AVANT, à l'octet près : le fichier porte
        // l'identifiant de l'entité, donc une nouvelle photo remplace la
        // précédente au lieu d'en accumuler.
        //
        // L'OBJET N'A PAS DE PRÉFIXE DE NIVEAU, et c'est historique : ses
        // photos s'appellent `<uid>/<id>.jpg` depuis toujours, celles des
        // quatre autres niveaux `<uid>/<niveau>-<id>.jpg`. Uniformiser
        // renommerait chaque fichier déjà déposé — et la policy de lecture
        // du stockage connaît les deux formes exprès (voir la migration
        // media_read_access). On garde donc les deux.
        path: level === 'objet' ? `${userId}/${entityId}.jpg` : `${userId}/${level}-${entityId}.jpg`,
        then: { table, id: entityId, column: 'photo_url' },
      }),
    ],
    localUri: photo,
  };
}
