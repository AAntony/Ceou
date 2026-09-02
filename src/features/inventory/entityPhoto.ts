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

function isLocalUri(uri: string): boolean {
  // Une photo fraîchement choisie est un fichier local (file:, content:,
  // blob:, data:) ; une photo déjà enregistrée est une URL Supabase.
  return !uri.startsWith('http://') && !uri.startsWith('https://');
}

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
  if (!isLocalUri(photo)) return { column: { photo_url: photo }, ops: [], localUri: null };

  return {
    column: {},
    ops: [
      uploadOp({
        uri: photo,
        bucket: 'objets',
        // MÊME CHEMIN QU'AVANT, à l'octet près : le fichier porte
        // l'identifiant de l'entité, donc une nouvelle photo remplace la
        // précédente au lieu d'en accumuler.
        path: `${userId}/${level}-${entityId}.jpg`,
        then: { table, id: entityId, column: 'photo_url' },
      }),
    ],
    localUri: photo,
  };
}
