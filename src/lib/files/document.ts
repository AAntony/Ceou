import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { isLocalUri } from '../images/media';
import { supabase } from '../supabase/client';

// UN DOCUMENT QUI N'EST PAS UNE IMAGE.
//
// Tout le stockage de l'app passait jusqu'ici par `uploadImage`, qui
// REDIMENSIONNE et RÉ-ENCODE en JPEG. C'est exactement ce qu'il faut pour une
// photo, et exactement ce qu'il ne faut pas pour un PDF : le ré-encodage le
// détruirait purement et simplement.
//
// POURQUOI CE MODULE EXISTE : une bonne part des factures d'aujourd'hui
// n'ont jamais été du papier. Amazon, la Fnac, Darty, les garanties
// constructeur et les contrats d'assurance arrivent en PDF par courriel.
// Photographier l'écran est la seule chose que l'app savait en faire — et ça
// perd les pages suivantes et la moitié de la lisibilité.

export const PDF_MIME = 'application/pdf';
/** L'identifiant de type d'Apple, que la feuille de partage iOS attend. */
const PDF_UTI = 'com.adobe.pdf';

export type DocumentChoisi = { uri: string; name: string };

/**
 * Choisir un PDF dans les fichiers de l'appareil.
 *
 * Rend `null` quand la personne referme le sélecteur sans rien choisir — ce
 * qui n'est pas une erreur et ne doit rien afficher.
 */
export async function pickPdf(): Promise<DocumentChoisi | null> {
  const resultat = await DocumentPicker.getDocumentAsync({
    type: PDF_MIME,
    // INDISPENSABLE ICI, plus qu'ailleurs. Sans copie, Android rend une
    // adresse `content://` dont l'autorisation de lecture expire avec l'écran
    // qui l'a demandée. Or l'envoi n'a PAS lieu tout de suite : il part en
    // file d'écriture, et peut n'aboutir qu'au retour du réseau, des heures
    // plus tard. La copie dans le cache est ce qui rend ce délai possible.
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (resultat.canceled) return null;
  const fichier = resultat.assets[0];
  return fichier ? { uri: fichier.uri, name: fichier.name } : null;
}

/**
 * Envoyer un fichier TEL QUEL, sans le toucher.
 *
 * Le pendant d'`uploadImage` pour ce qui n'est pas une image. Rend l'adresse
 * stockée, horodatée comme les photos : le chemin ne change pas quand on
 * remplace un document, et sans cet horodatage l'ancien resterait affiché.
 */
export async function uploadDocument(
  uri: string,
  { bucket, path, contentType }: { bucket: string; path: string; contentType: string },
): Promise<string> {
  // `File` d'expo-file-system ne comprend que les chemins d'appareil et casse
  // sur le web — même précaution que dans uploadImage. Le web n'est pas la
  // cible, mais il sert à vérifier.
  const octets =
    Platform.OS === 'web'
      ? new Uint8Array(await (await fetch(uri)).arrayBuffer())
      : await new File(uri).bytes();

  const { error } = await supabase.storage.from(bucket).upload(path, octets, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?updated=${Date.now()}`;
}

/**
 * Ouvrir un PDF avec ce que le téléphone sait faire.
 *
 * Deux chemins, parce que le fichier n'est pas au même endroit selon le
 * moment : à peine choisi il est sur l'appareil et n'est pas encore parti
 * (l'envoi passe par la file d'écriture, parfois des heures plus tard) ; une
 * fois envoyé, il n'existe plus que derrière une adresse signée.
 *
 * Rend `false` quand aucun des deux n'est possible — à l'appelant de le dire.
 */
export async function ouvrirPdf(uri: string, adresseSignee: string | null): Promise<boolean> {
  if (isLocalUri(uri)) {
    // La feuille de partage porte aussi « Ouvrir avec » : c'est le seul moyen
    // d'ouvrir un fichier local sans embarquer un lecteur de PDF.
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: PDF_MIME, UTI: PDF_UTI });
    return true;
  }

  // Le navigateur affiche les PDF de lui-même sur les deux systèmes, et
  // l'adresse signée reste valable le temps de la lecture.
  if (!adresseSignee) return false;
  await Linking.openURL(adresseSignee);
  return true;
}
