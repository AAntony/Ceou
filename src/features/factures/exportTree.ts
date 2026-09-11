// L'ARBRE À COCHER DE L'EXPORT, ET LA SÉLECTION QUI S'Y PROMÈNE.
//
// Rien ici ne touche à React ni au réseau : ce sont des fonctions pures sur
// les lignes rendues par `factures_export_rows`. C'est ce qui permet de les
// éprouver sur des cas tordus — une facture à cheval sur deux pièces, un
// conteneur dans un conteneur — sans monter un écran.
//
// ═══ LA SÉLECTION VIT SUR LES FEUILLES, JAMAIS SUR LES BRANCHES ═══
//
// La tentation était de retenir « la Pièce est cochée ». Elle se paie
// aussitôt : que devient cette coche quand on décoche un seul de ses objets ?
// Il faut alors défaire la coche du parent et recocher tous les frères, et
// ce raccommodage se refait à chaque niveau — c'est là que ces arbres se
// trompent.
//
// On ne retient donc QUE des objets. L'état d'une branche se DÉDUIT : toutes
// ses feuilles cochées, aucune, ou entre les deux. Cocher une branche coche
// ses feuilles, la décocher les décoche. Il n'y a plus qu'une vérité, et
// l'affichage n'en est qu'une lecture.

export type ChainKind = 'habitation' | 'piece' | 'emplacement' | 'conteneur';
export type NodeKind = ChainKind | 'objet';

/** Un maillon du chemin, tel que la fonction SQL le rend. */
type ChainLink = { kind: ChainKind; id: string; name: string; is_default: boolean };

/** Une ligne de `factures_export_rows` : un couple (facture, objet). */
export type ExportRow = {
  facture_id: string;
  vendor: string | null;
  amount: number | null;
  purchase_date: string | null;
  warranty_until: string | null;
  document_url: string | null;
  document_kind: string;
  created_at: string;
  objet_id: string;
  objet_name: string;
  chain: unknown;
};

export type TreeNode = {
  /** Unique dans tout l'arbre : deux entités de types différents peuvent porter le même id. */
  key: string;
  kind: NodeKind;
  id: string;
  name: string;
  children: TreeNode[];
  /**
   * Les clés des objets qui pendent de ce nœud, feuilles comprises.
   *
   * Précalculées parce que TOUT en dépend : l'état de la case, ce que coche
   * un appui, et le compte affiché. Les recalculer à chaque rendu ferait
   * reparcourir l'arbre entier pour chaque rangée visible.
   */
  leaves: string[];
  /** Les factures atteignables depuis ce nœud, dédoublonnées. */
  factureIds: string[];
};

export function nodeKey(kind: NodeKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Le chemin d'une ligne, nettoyé.
 *
 * LA PIÈCE PAR DÉFAUT EST ÉCARTÉE. Une habitation mono-espace (Garage, Cave,
 * Box, Véhicule) porte une pièce unique qui n'existe que pour tenir le
 * schéma : elle a le nom de l'habitation, et toute l'app la masque. La
 * laisser passer donnerait un « Garage » à déplier pour trouver « Garage ».
 */
function cheminDe(row: ExportRow): ChainLink[] {
  if (!Array.isArray(row.chain)) return [];
  return (row.chain as ChainLink[]).filter(
    (lien) => lien && typeof lien.id === 'string' && !(lien.kind === 'piece' && lien.is_default),
  );
}

/**
 * L'arbre des seules branches qui portent une facture.
 *
 * Une branche n'existe ici que parce qu'une facture y mène : on ne peut pas
 * exporter ce qui n'existe pas, et un arbre qui montrerait tout l'inventaire
 * ferait chercher douze feuilles parmi deux cents.
 */
export function buildExportTree(rows: ExportRow[]): TreeNode[] {
  const racines: TreeNode[] = [];
  const index = new Map<string, TreeNode>();

  const obtenir = (parent: TreeNode | null, kind: NodeKind, id: string, name: string): TreeNode => {
    const key = nodeKey(kind, id);
    const deja = index.get(key);
    if (deja) return deja;

    const noeud: TreeNode = { key, kind, id, name, children: [], leaves: [], factureIds: [] };
    index.set(key, noeud);
    (parent ? parent.children : racines).push(noeud);
    return noeud;
  };

  for (const row of rows) {
    const chemin = cheminDe(row);
    if (chemin.length === 0) continue;

    let parent: TreeNode | null = null;
    for (const lien of chemin) {
      parent = obtenir(parent, lien.kind, lien.id, lien.name);
    }

    const feuille = obtenir(parent, 'objet', row.objet_id, row.objet_name);
    if (!feuille.factureIds.includes(row.facture_id)) feuille.factureIds.push(row.facture_id);
  }

  for (const racine of racines) remonter(racine);
  trier(racines);
  return racines;
}

/** Fait remonter feuilles et factures des enfants vers leurs parents. */
function remonter(noeud: TreeNode): void {
  if (noeud.kind === 'objet') {
    noeud.leaves = [noeud.key];
    return;
  }

  const feuilles = new Set<string>();
  const factures = new Set<string>();
  for (const enfant of noeud.children) {
    remonter(enfant);
    for (const f of enfant.leaves) feuilles.add(f);
    for (const f of enfant.factureIds) factures.add(f);
  }
  noeud.leaves = [...feuilles];
  noeud.factureIds = [...factures];
}

/**
 * Par nom, et les branches avant les objets.
 *
 * Un Emplacement peut contenir à la fois des Conteneurs et des Objets posés
 * directement. Mélangés par ordre alphabétique, on perd le fait que les uns
 * se déplient et les autres non.
 */
function trier(noeuds: TreeNode[]): void {
  noeuds.sort((a, b) => {
    if ((a.kind === 'objet') !== (b.kind === 'objet')) return a.kind === 'objet' ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  for (const noeud of noeuds) trier(noeud.children);
}

export type EtatCase = 'none' | 'some' | 'all';

/** Ce que la case d'un nœud doit montrer, déduit de ses feuilles. */
export function etatDe(noeud: TreeNode, selection: Set<string>): EtatCase {
  if (noeud.leaves.length === 0) return 'none';
  let coches = 0;
  for (const feuille of noeud.leaves) if (selection.has(feuille)) coches += 1;
  if (coches === 0) return 'none';
  return coches === noeud.leaves.length ? 'all' : 'some';
}

/**
 * Ce que devient la sélection quand on appuie sur la case d'un nœud.
 *
 * PARTIELLEMENT COCHÉ SE COMPLÈTE, il ne se vide pas. Quelqu'un qui a coché
 * trois objets sur dix et qui appuie sur la Pièce veut visiblement la Pièce
 * entière ; lui rendre une sélection vide lui ferait perdre ses trois coches
 * pour rien.
 */
export function basculer(noeud: TreeNode, selection: Set<string>): Set<string> {
  const suivante = new Set(selection);
  const vider = etatDe(noeud, selection) === 'all';
  for (const feuille of noeud.leaves) {
    if (vider) suivante.delete(feuille);
    else suivante.add(feuille);
  }
  return suivante;
}

/**
 * L'arbre mis à plat, replis compris : ce que la liste affiche réellement.
 *
 * UNE LISTE PLATE ET NON DES VUES IMBRIQUÉES. Un arbre rendu par récursion
 * monte tout ce qu'il contient, y compris les branches repliées ; et il
 * interdit la virtualisation, puisqu'il n'y a plus de liste à virtualiser.
 * Aplati, c'est une FlatList ordinaire — le retrait fait le reste du travail
 * d'illusion.
 */
export function aplatir(racines: TreeNode[], ouverts: Set<string>): { noeud: TreeNode; profondeur: number }[] {
  const lignes: { noeud: TreeNode; profondeur: number }[] = [];

  const descendre = (noeuds: TreeNode[], profondeur: number) => {
    for (const noeud of noeuds) {
      lignes.push({ noeud, profondeur });
      if (noeud.children.length > 0 && ouverts.has(noeud.key)) descendre(noeud.children, profondeur + 1);
    }
  };

  descendre(racines, 0);
  return lignes;
}

/** Toutes les feuilles de l'arbre, pour « Tout sélectionner ». */
export function toutesLesFeuilles(racines: TreeNode[]): Set<string> {
  const feuilles = new Set<string>();
  for (const racine of racines) for (const f of racine.leaves) feuilles.add(f);
  return feuilles;
}

/**
 * Les factures que cette sélection emporte, chacune une seule fois.
 *
 * UNE FACTURE COUVRANT TROIS OBJETS NE S'IMPRIME QU'UNE FOIS, même si les
 * trois sont cochés — et elle part dès que l'UN d'eux l'est. C'est bien ce
 * qu'on veut : on exporte des preuves d'achat, pas des lignes de liaison.
 */
export function facturesSelectionnees(rows: ExportRow[], selection: Set<string>): ExportRow[] {
  const vues = new Set<string>();
  const retenues: ExportRow[] = [];
  for (const row of rows) {
    if (!selection.has(nodeKey('objet', row.objet_id))) continue;
    if (vues.has(row.facture_id)) continue;
    vues.add(row.facture_id);
    retenues.push(row);
  }
  return retenues;
}

/**
 * Les noms des objets qu'une facture couvre, DANS LA SÉLECTION.
 *
 * Le PDF nomme les objets prouvés par chaque ticket. Il ne nomme que ceux
 * qu'on a demandés : exporter le salon ne doit pas révéler qu'une même
 * facture couvre aussi quelque chose de la chambre.
 */
export function objetsDeLaFacture(rows: ExportRow[], factureId: string, selection: Set<string>): string[] {
  const noms: string[] = [];
  for (const row of rows) {
    if (row.facture_id !== factureId) continue;
    if (!selection.has(nodeKey('objet', row.objet_id))) continue;
    if (!noms.includes(row.objet_name)) noms.push(row.objet_name);
  }
  return noms.sort((a, b) => a.localeCompare(b));
}
