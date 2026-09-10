import { supabase } from '../supabase/client';

// DEMANDER UNE ADRESSE SIGNEE, MAIS PAS UNE PAR PHOTO.
//
// Une liste de résultats de recherche affiche vingt vignettes. Vingt appels
// à `createSignedUrl`, c'est vingt allers-retours réseau pour afficher une
// grille — sur un téléphone, en 4G, c'est la différence entre une liste qui
// s'affiche et une liste qui se remplit par à-coups.
//
// Ce module regroupe : les demandes qui arrivent pendant le même rendu
// partent ensemble, en un appel par bucket. `createSignedUrls` rend le
// chemin dans chaque résultat, ce qui permet de rendre à chaque demandeur
// exactement ce qu'il attendait.

/**
 * Durée de validité d'une signature.
 *
 * Une heure, et pas dix minutes : l'adresse ne sert qu'au MOMENT du
 * téléchargement. Une fois l'image obtenue, expo-image la garde sous sa clé
 * de cache, qui ne dépend pas de la signature — l'expiration ne fait donc
 * jamais disparaître une photo déjà affichée. Rallonger n'apporterait rien,
 * raccourcir multiplierait les re-signatures sans rien protéger de plus.
 */
export const SIGNATURE_TTL_SECONDS = 60 * 60;

type Demande = {
  path: string;
  resolve: (url: string | null) => void;
  reject: (raison: unknown) => void;
};

const enAttente = new Map<string, Demande[]>();
let programme = false;

function programmer() {
  if (programme) return;
  programme = true;
  // `setTimeout(0)` plutôt qu'une microtâche : on veut laisser le rendu
  // complet d'une liste déposer ses demandes avant de partir. Une
  // microtâche se viderait dès le premier composant monté, et on n'aurait
  // regroupé personne.
  setTimeout(() => void vider(), 0);
}

async function vider() {
  programme = false;
  const lots = new Map(enAttente);
  enAttente.clear();

  await Promise.all(
    [...lots].map(async ([bucket, demandes]) => {
      // Deux vignettes peuvent viser le même fichier — l'avatar d'un ami qui
      // apparaît deux fois dans un écran. On ne le demande qu'une fois.
      const chemins = [...new Set(demandes.map((d) => d.path))];

      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(chemins, SIGNATURE_TTL_SECONDS);
        if (error || !data) throw error ?? new Error('signature refusée');

        const parChemin = new Map(data.map((entry) => [entry.path, entry.signedUrl]));
        for (const demande of demandes) {
          // ABSENT N'EST PAS EN PANNE. Un chemin refusé par la RLS, ou dont
          // le fichier n'existe plus, rend `null` — c'est une réponse, pas
          // une erreur, et elle ne doit pas être retentée en boucle.
          demande.resolve(parChemin.get(demande.path) ?? null);
        }
      } catch (raison) {
        // L'appel entier a échoué : réseau coupé, service indisponible. Là
        // c'est bien une erreur, et l'appelant doit pouvoir la distinguer
        // pour retomber sur son cache.
        for (const demande of demandes) demande.reject(raison);
      }
    }),
  );
}

/** L'adresse signée d'un fichier, ou `null` s'il n'est pas accessible. */
export function signMedia(bucket: string, path: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const file = enAttente.get(bucket) ?? [];
    file.push({ path, resolve, reject });
    enAttente.set(bucket, file);
    programmer();
  });
}
