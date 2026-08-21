import { uploadImage } from '../../lib/images/pickAndUploadImage';
import type { EntityLevel } from './placeholders';

// Téléversement des photos d'Habitation / Pièce / Emplacement / Conteneur.
//
// BUCKET RÉUTILISÉ, délibérément. Tout part dans `objets`, le bucket qui
// existe déjà, sous un chemin `<uid>/<niveau>-<id>.jpg`. Un bucket par
// niveau aurait été plus joli à lire, mais aurait demandé de retoucher les
// policies de `storage.objects` — or ce sont exactement elles qui ont cassé
// l'envoi de photos le 19/08 (voir la migration restore_owner_storage_read).
// Le préfixe de dossier reste l'uid, donc la policy existante s'applique
// telle quelle, sans y toucher.

function isLocalUri(uri: string): boolean {
  // Une photo fraîchement choisie est un fichier local (file:, content:,
  // blob:, data:) ; une photo déjà enregistrée est une URL Supabase.
  return !uri.startsWith('http://') && !uri.startsWith('https://');
}

/**
 * Ce qu'il faut écrire dans `photo_url`, ou `undefined` s'il n'y a rien à
 * changer.
 *
 * Les trois cas sont distincts et il faut les garder distincts : « pas
 * touché » ne doit surtout pas s'écrire comme « retirée », sinon ouvrir la
 * fiche pour corriger un nom effacerait la photo au passage.
 */
export async function resolveEntityPhotoUrl(params: {
  level: EntityLevel;
  entityId: string;
  userId: string;
  /** Ce que le formulaire affiche : uri locale, URL distante, ou rien. */
  chosen: string | null;
  /** Ce qui est enregistré aujourd'hui. */
  current: string | null;
}): Promise<string | null | undefined> {
  const { level, entityId, userId, chosen, current } = params;

  if (chosen === current) return undefined;
  if (chosen === null) return null;
  if (!isLocalUri(chosen)) return undefined;

  return uploadImage(chosen, { bucket: 'objets', path: `${userId}/${level}-${entityId}.jpg` });
}
