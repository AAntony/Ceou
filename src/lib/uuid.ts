// Le polyfill de `crypto.getRandomValues`, qui n'existe pas nativement dans le
// moteur JavaScript de React Native. Déjà chargé par secureStorage, mais
// réimporté ici pour que ce module tienne debout seul : un fichier qui dépend
// d'un effet de bord importé ailleurs casse le jour où cet ailleurs change.
import 'react-native-get-random-values';

/**
 * UN IDENTIFIANT GÉNÉRÉ ICI, ET PLUS PAR LA BASE.
 *
 * C'est ce qui rend possible d'écrire hors-ligne. Jusqu'ici, chaque création
 * partait en `insert(...).select().single()` : Postgres posait l'UUID et
 * l'app le relisait. Sans réseau il n'y a personne pour le poser — et surtout
 * l'inventaire est IMBRIQUÉ. Créer une Pièce, puis un Emplacement dedans,
 * puis un Objet dedans, ce sont trois écritures dont les deux dernières
 * référencent un parent qui n'existe encore nulle part. Il faut donc connaître
 * l'identifiant du parent AVANT que le serveur ne l'ait vu.
 *
 * Les colonnes `id` de toutes les tables sont en `default gen_random_uuid()`
 * et non en `generated always` : une valeur fournie par le client est acceptée
 * telle quelle, le défaut ne s'applique que si on n'en donne pas. Vérifié dans
 * les migrations avant d'écrire ce fichier.
 *
 * VERSION 4, VARIANTE RFC 4122 : la base attend le type `uuid`, elle refuserait
 * une chaîne qui n'en respecte pas la forme. Les deux masquages ci-dessous
 * posent les bits de version et de variante que la norme impose.
 *
 * Le risque de collision entre deux appareils hors-ligne est celui d'un UUID
 * v4 quelconque — c'est-à-dire nul à l'échelle de cette application. Et une
 * collision ne passerait de toute façon pas inaperçue : la clé primaire la
 * refuserait, l'écriture échouerait bruyamment plutôt que d'écraser.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));

  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
