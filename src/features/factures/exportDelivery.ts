import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';

// OÙ VA LE FICHIER UNE FOIS QU'IL EXISTE.
//
// Deux sorties, parce qu'elles répondent à deux gestes différents : « je
// l'envoie à mon assureur maintenant » et « je le garde ». Elles passent par
// deux modules distincts, et c'est le système qui fait le travail dans les
// deux cas — l'app n'écrit jamais dans les dossiers du téléphone elle-même,
// ce qui lui éviterait une permission de stockage à demander et à justifier.
//
// LE PARTAGE SERT AUSSI DE FILET AU MAIL. Un téléphone Android sans compte
// mail configuré fait répondre non à `MailComposer.isAvailableAsync()` ; sans
// repli, le bouton ne ferait rien du tout et personne ne saurait pourquoi.
// La feuille de partage, elle, contient de toute façon les applications de
// messagerie installées.

const MIME = 'application/pdf';
/** L'identifiant de type d'Apple, que la feuille de partage iOS attend. */
const UTI = 'com.adobe.pdf';

export type IssueEnvoi = 'envoye' | 'annule' | 'partage';

/**
 * Ouvre le brouillon d'un mail, le PDF déjà en pièce jointe.
 *
 * ANDROID RÉPOND TOUJOURS « envoyé », quoi qu'ait fait la personne — c'est
 * documenté par Expo et on n'y peut rien. L'écran ne doit donc pas se servir
 * de cette réponse pour affirmer quoi que ce soit à l'utilisateur : il sait
 * seulement que le brouillon s'est ouvert.
 */
export async function envoyerParMail(
  uri: string,
  { sujet, corps }: { sujet: string; corps: string },
): Promise<IssueEnvoi> {
  if (!(await MailComposer.isAvailableAsync())) {
    await partager(uri);
    return 'partage';
  }

  const { status } = await MailComposer.composeAsync({
    subject: sujet,
    body: corps,
    attachments: [uri],
  });
  return status === 'cancelled' ? 'annule' : 'envoye';
}

/**
 * Ouvre la feuille de partage du système.
 *
 * C'EST ELLE, LE « ENREGISTRER DANS LE TÉLÉPHONE ». Sur iOS elle offre
 * « Enregistrer dans Fichiers », sur Android le sélecteur de dossier — plus
 * tout le reste (Drive, une messagerie, un autre téléphone). Écrire nous-même
 * dans le stockage demanderait une permission, ne marcherait pas pareil sur
 * les deux systèmes, et rangerait le fichier là où NOUS aurions décidé.
 */
export async function partager(uri: string, titre?: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: MIME, UTI, dialogTitle: titre });
  return true;
}
