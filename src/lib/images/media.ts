import type { ImageSource } from 'expo-image';
import { useMemo } from 'react';

// LE SEUL ENDROIT QUI SAIT COMMENT UNE PHOTO DEVIENT UNE IMAGE AFFICHABLE.
//
// Jusqu'ici chaque écran faisait `source={{ uri: photo_url }}` : la valeur
// stockée en base était directement l'adresse à charger. Ça ne tiendra plus
// dès que les buckets seront privés — une URL publique cessera de répondre,
// et il faudra demander une adresse signée, valable un temps limité.
//
// Ce module est la couture posée avant ce changement. Les écrans passent leur
// valeur stockée, ils reçoivent une source d'image, et ils n'ont pas à savoir
// ce qu'il y a entre les deux. Le jour où signer devient nécessaire, seul
// l'intérieur de `useMediaSource` bouge.
//
// C'EST UN HOOK ALORS QU'IL N'EN A PAS ENCORE BESOIN, et c'est délibéré :
// signer est un appel réseau, donc asynchrone. En posant la forme définitive
// tout de suite, les neuf écrans concernés ne sont modifiés qu'une fois.

/** Préfixe des adresses publiques de Supabase Storage. */
const PUBLIC_MARKER = '/storage/v1/object/public/';

/**
 * Un fichier encore sur l'appareil, choisi mais pas encore téléversé.
 *
 * La file d'écriture affiche la photo tout de suite à partir de son chemin
 * local et n'envoie le fichier qu'ensuite, éventuellement au retour du
 * réseau (voir entityPhoto.ts). Ces valeurs-là ne se signent pas et ne se
 * mettent pas en cache : elles sont déjà là.
 */
export function isLocalUri(value: string): boolean {
  return !value.startsWith('http://') && !value.startsWith('https://');
}

/**
 * Ce qu'une valeur stockée désigne réellement, une fois retiré tout ce qui
 * n'est que de l'adressage.
 *
 * Une valeur stockée ressemble à :
 *   https://<projet>.supabase.co/storage/v1/object/public/objets/<uid>/<id>.jpg?updated=1755…
 *
 * Le `?updated=` est un cache-buster posé à l'envoi (pickAndUploadImage) :
 * le chemin ne change pas quand on remplace une photo — l'envoi écrase le
 * fichier — donc sans lui l'ancienne image resterait affichée. Il fait
 * partie de l'identité de la version, pas de l'adresse : il va donc dans la
 * clé de cache, et nulle part ailleurs.
 */
export function parseStoredMedia(value: string): { bucket: string; path: string; version: string } | null {
  const marker = value.indexOf(PUBLIC_MARKER);
  if (marker === -1) return null;

  const after = value.slice(marker + PUBLIC_MARKER.length);
  const [addressed, query = ''] = after.split('?');
  const slash = addressed.indexOf('/');
  if (slash <= 0) return null;

  return {
    bucket: addressed.slice(0, slash),
    path: addressed.slice(slash + 1),
    version: new URLSearchParams(query).get('updated') ?? '',
  };
}

/**
 * La source à donner à `<Image>` d'expo-image.
 *
 * `cacheKey` est la raison d'être de ce module. Par défaut expo-image range
 * ses fichiers sous l'adresse complète ; or une adresse signée change à
 * chaque signature. Sans clé stable, chaque nouvelle signature serait un
 * cache manqué — et une photo déjà téléchargée redeviendrait invisible dès
 * qu'on est hors réseau. En posant le chemin (plus la version) comme clé, le
 * cache survit aux re-signatures, et le hors ligne avec lui.
 */
export function useMediaSource(value: string | null | undefined): ImageSource | null {
  return useMemo(() => {
    if (!value) return null;
    if (isLocalUri(value)) return { uri: value };

    const parsed = parseStoredMedia(value);
    // Une adresse qu'on ne sait pas lire est rendue telle quelle : mieux vaut
    // une photo affichée sans clé de cache stable que pas de photo du tout.
    if (!parsed) return { uri: value };

    return {
      uri: value,
      cacheKey: `${parsed.bucket}/${parsed.path}${parsed.version ? `?v=${parsed.version}` : ''}`,
    };
  }, [value]);
}
