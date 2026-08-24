import {
  Canvas,
  DashPathEffect,
  Line,
  matchFont,
  Rect,
  Text as SkiaText,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { IconName } from '../../components/Icon';
import { DEFAULT_PIECE_COLOR } from '../inventory/constants';
import type { PlanDoor, PlanForme, PlanPin } from '../../types/database';
import {
  DOOR_JAMB_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  roomColorForForme,
  ROOM_FILL_OPACITY,
  WALL_COLOR,
  WALL_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import { DoorLayer } from './DoorLayer';
import { PlanPinLayer } from './PlanPinLayer';
import type { PinSize } from './pinSize';
import { doorJambs, doorSpan, wallSegments, wallWidth } from './walls';
import type { DoorEdge } from './types';
import { clamp, clampPositionToWorld, clampResizeToWorld, clampSize, snapPosition, snapResize } from './snap';
import type { HandleId, ShapeGeometry } from './types';
import { useThemeColors } from '../../lib/theme';

const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// Le bleu d'action de l'app. Constante ici plutôt que via le thème : ces
// traits se posent sur la feuille du plan, qui garde le même fond clair dans
// les deux thèmes — une couleur qui s'adapterait au thème perdrait justement
// son contraste sur cette feuille.
const ACCENT = '#1591EA';

function handleAnchor(geo: ShapeGeometry, handle: HandleId): { x: number; y: number } {
  const cx = geo.x + geo.width / 2;
  const cy = geo.y + geo.height / 2;
  const right = geo.x + geo.width;
  const bottom = geo.y + geo.height;
  const positions: Record<HandleId, { x: number; y: number }> = {
    nw: { x: geo.x, y: geo.y },
    n: { x: cx, y: geo.y },
    ne: { x: right, y: geo.y },
    e: { x: right, y: cy },
    se: { x: right, y: bottom },
    s: { x: cx, y: bottom },
    sw: { x: geo.x, y: bottom },
    w: { x: geo.x, y: cy },
  };
  return positions[handle];
}

// Chaque poignée ne déplace que les bords qu'elle touche ; le(s) bord(s)
// opposé(s) restent ancrés sur la géométrie au début du geste.
function applyHandle(origin: ShapeGeometry, handle: HandleId, dx: number, dy: number): ShapeGeometry {
  let { x, y, width, height } = origin;
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;

  if (handle.includes('w')) {
    width = clampSize(origin.width - dx);
    x = right - width;
  }
  if (handle.includes('e')) {
    width = clampSize(origin.width + dx);
  }
  if (handle.includes('n')) {
    height = clampSize(origin.height - dy);
    y = bottom - height;
  }
  if (handle.includes('s')) {
    height = clampSize(origin.height + dy);
  }
  return { x, y, width, height };
}

type ZoomState = { scale: number; translateX: number; translateY: number };
const IDLE_ZOOM: ZoomState = { scale: 1, translateX: 0, translateY: 0 };

// La feuille (WORLD_WIDTH x WORLD_HEIGHT) est une zone FIXE et LIMITÉE : on
// ne peut jamais dézoomer plus loin que "toute la feuille visible d'un coup"
// (minScale), ni glisser la vue pour révéler quoi que ce soit au-delà de son
// bord. Sur l'axe où la feuille projetée est plus petite que le viewport,
// elle reste centrée (rien à glisser sur cet axe) ; sur l'axe où elle est
// plus grande, le glissé est borné pile à ses bords — jamais de vide au-delà.
// Même principe qu'une visionneuse d'image/PDF (contain, puis pan une fois
// zoomé), plutôt qu'un canevas panoramique sans limite perceptible.
function clampZoomState(z: ZoomState, viewportW: number, viewportH: number, minScale: number): ZoomState {
  const scale = clamp(z.scale, minScale, MAX_ZOOM);
  const contentW = WORLD_WIDTH * scale;
  const contentH = WORLD_HEIGHT * scale;
  const translateX = contentW <= viewportW ? (viewportW - contentW) / 2 : clamp(z.translateX, viewportW - contentW, 0);
  const translateY = contentH <= viewportH ? (viewportH - contentH) / 2 : clamp(z.translateY, viewportH - contentH, 0);
  return { scale, translateX, translateY };
}

type PlanCanvasProps = {
  formes: PlanForme[];
  pieceInfo: Record<string, { name: string; color: string | null }>;
  pins: PlanPin[];
  pinDisplay: Record<string, { name: string; icon: IconName }>;
  doors: PlanDoor[];
  highlightFormeId?: string | null;
  highlightEmplacementId?: string | null;
  selectedFormeId: string | null;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onSelect: (forme: PlanForme) => void;
  onDeselect: () => void;
  onPinDragEnd: (pinId: string, relX: number, relY: number) => void;
  onPinTap: (pin: PlanPin) => void;
  /** Taille d'affichage des puces (S/M/XL), choisie au-dessus du plan. */
  pinSize: PinSize;
  selectedPinId: string | null;
  onPinSelect: (pinId: string | null) => void;
  /** Pose armée depuis la barre d'édition : les murs deviennent des cibles. */
  doorPlacing: boolean;
  selectedDoorId: string | null;
  onDoorCreate: (formeId: string, edge: DoorEdge, position: number) => void;
  onDoorSelect: (door: PlanDoor) => void;
  onDoorDragEnd: (doorId: string, edge: DoorEdge, position: number) => void;
  /** Nombre d'objets par Pièce — une pièce qui n'annonce pas son contenu ne
   *  répond pas à la question que le plan est censé aider à résoudre. */
  roomCounts?: Record<string, number>;
  // Consultation seule : le plan reste explorable (zoom, déplacement de la
  // vue, lecture des noms et des pastilles) mais plus rien n'est modifiable.
  // Sans ça, un ami en Consultation ou un visiteur pouvait glisser une pièce
  // et voir la RLS refuser l'écriture côté serveur — la pièce revenait à sa
  // place sans un mot d'explication.
  readOnly?: boolean;
};

// Exposé via ref pour que l'écran parent (bouton "Ajouter une pièce", hors
// du canevas) puisse savoir où l'utilisateur regarde ACTUELLEMENT — le zoom/
// pan vit uniquement dans ce composant (state interne, mis à jour à chaque
// frame de geste), pas question de le faire remonter en props/callback à
// chaque frame juste pour ce besoin ponctuel.
export type PlanCanvasHandle = {
  getViewportCenter: () => { x: number; y: number };
  /** « Tout revoir » : cadre toutes les pièces posées. Le double-appui sur
   *  une zone vide fait la même chose, mais rien ne l'annonce — d'où le
   *  bouton flottant de l'écran, qui appelle ceci. */
  recenter: () => void;
};

export const PlanCanvas = forwardRef<PlanCanvasHandle, PlanCanvasProps>(function PlanCanvas(
  {
    formes,
    pieceInfo,
    pins,
    pinDisplay,
    doors,
    highlightFormeId,
    highlightEmplacementId,
    selectedFormeId,
    onDragEnd,
    onResizeEnd,
    onSelect,
    onDeselect,
    onPinDragEnd,
    onPinTap,
    pinSize,
    selectedPinId,
    onPinSelect,
    doorPlacing,
    selectedDoorId,
    onDoorCreate,
    onDoorSelect,
    onDoorDragEnd,
    roomCounts,
    readOnly = false,
  },
  ref,
) {
  const colors = useThemeColors();
  // Position ET taille vivent dans le même state, mises à jour en direct par
  // le déplacement (x/y) et les poignées de redimensionnement (x/y/width/
  // height) — un seul aller-retour réseau à la fin du geste, pas à chaque
  // frame. Plan 2D top-down pur : les coordonnées x/y SONT les coordonnées
  // écran (dans le repère du contenu zoomable), aucune projection.
  const [shapes, setShapes] = useState<Record<string, ShapeGeometry>>({});
  const [zoom, setZoom] = useState<ZoomState>(IDLE_ZOOM);
  const zoomOrigin = useRef(IDLE_ZOOM);
  // Le canevas occupe maintenant tout l'espace disponible sous l'en-tête fixe
  // (largeur ET hauteur, mesurées via onLayout) plutôt qu'une hauteur figée —
  // c'est ce viewport, pas la taille de la feuille elle-même, qui borne le
  // zoom/pan (voir clampZoomState/minScale plus bas).
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  // Aperçu de l'ouverture pendant la pose, tant que le doigt est posé sur un
  // mur. Sans lui, on appuyait à l'aveugle et on découvrait où la porte était
  // tombée après coup — le reproche exact du dernier test.
  const [doorPreview, setDoorPreview] = useState<{ formeId: string; edge: DoorEdge; position: number } | null>(null);
  const initializedRef = useRef(false);
  const centeredHighlightRef = useRef<string | null>(null);
  // matchFont() can throw if Skia's CanvasKit/WASM backend (web only —
  // native Skia has no such async init delay) isn't ready yet, which would
  // otherwise crash this whole screen. Labels are a nice-to-have on top of
  // the shapes themselves, so degrade to no labels rather than a blank
  // screen if font matching isn't available yet.
  const font = useMemo(() => {
    try {
      return matchFont({
        fontFamily: Platform.select({ android: 'sans-serif-medium', ios: 'Helvetica', default: 'sans-serif' }),
        fontSize: 12,
      });
    } catch {
      return null;
    }
  }, []);

  // Seconde police pour le nombre d'objets : plus petite et plus discrète que
  // le nom, pour que la hiérarchie se lise sans couleur supplémentaire.
  const countFont = useMemo(() => {
    try {
      return matchFont({
        fontFamily: Platform.select({ android: 'sans-serif', ios: 'Helvetica', default: 'sans-serif' }),
        fontSize: 9,
      });
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setShapes((current) => {
      const next = { ...current };
      const ids = new Set(formes.map((f) => f.id));
      for (const forme of formes) {
        // Resynchronise TOUJOURS depuis le serveur, sauf la forme
        // actuellement sélectionnée (seule susceptible d'être en plein
        // geste de glisser/redimensionner — un refetch qui arriverait
        // pendant ce geste ne doit pas la faire "sauter" sous le doigt).
        // Avant ce correctif, une forme déjà connue de `next` (dès le
        // premier glissé) ne recevait plus JAMAIS de valeur fraîche d'un
        // refetch ultérieur — elle restait figée jusqu'au prochain montage
        // complet du composant, d'où "il faut fermer et rouvrir l'app"
        // pour voir une modification pourtant bien enregistrée côté serveur.
        if (forme.id === selectedFormeId && forme.id in next) continue;
        next[forme.id] = { x: forme.x, y: forme.y, width: forme.width, height: forme.height };
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [formes, selectedFormeId]);

  const geoById = useMemo(() => {
    const map: Record<string, ShapeGeometry> = {};
    for (const forme of formes) map[forme.id] = shapes[forme.id] ?? forme;
    return map;
  }, [formes, shapes]);

  const selectedForme = formes.find((f) => f.id === selectedFormeId) ?? null;

  // Zoom minimum dynamique : la plus petite échelle à laquelle la feuille
  // entière (WORLD_WIDTH x WORLD_HEIGHT) tient encore dans le viewport
  // mesuré — au-delà, impossible de dézoomer plus (voir clampZoomState).
  // C'est ce qui rend la zone de plan "limitée et fixe" : on peut toujours
  // voir toute la feuille d'un coup, jamais un vide sans borne autour.
  const minScale = useMemo(() => {
    if (!viewportSize.width || !viewportSize.height) return MIN_ZOOM;
    return Math.min(viewportSize.width / WORLD_WIDTH, viewportSize.height / WORLD_HEIGHT);
  }, [viewportSize]);

  // Recentre/zoome sur une zone du monde (unités feuille), avec une marge en
  // pixels écran — base commune à la vue initiale et au double-tap "tout
  // voir" (fitToRooms plus bas).
  const fitToBounds = (minX: number, minY: number, maxX: number, maxY: number, padding: number) => {
    const { width: vw, height: vh } = viewportSize;
    if (!vw || !vh) return;
    const boundsW = Math.max(maxX - minX, 1);
    const boundsH = Math.max(maxY - minY, 1);
    const availW = Math.max(vw - padding * 2, 1);
    const availH = Math.max(vh - padding * 2, 1);
    const scale = clamp(Math.min(availW / boundsW, availH / boundsH), minScale, MAX_ZOOM);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(clampZoomState({ scale, translateX: vw / 2 - cx * scale, translateY: vh / 2 - cy * scale }, vw, vh, minScale));
  };

  // Cadre toutes les pièces déjà posées (ou toute la feuille s'il n'y en a
  // aucune) : vue initiale à l'ouverture de l'écran ET action du double-tap
  // sur une zone vide du plan (backgroundDoubleTap plus bas) — "montre-moi
  // tout le plan d'un coup" plutôt qu'un simple retour à un zoom fixe.
  const fitToRooms = () => {
    if (formes.length === 0) {
      fitToBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0);
      return;
    }
    const geos = formes.map((f) => geoById[f.id]);
    fitToBounds(
      Math.min(...geos.map((g) => g.x)),
      Math.min(...geos.map((g) => g.y)),
      Math.max(...geos.map((g) => g.x + g.width)),
      Math.max(...geos.map((g) => g.y + g.height)),
      48,
    );
  };

  // Amène une pièce précise au centre du viewport sans changer le zoom en
  // cours — utilisé en arrivant depuis "Voir sur le plan" (fiche Objet), où
  // situer la pièce importe plus qu'imposer un niveau de zoom arbitraire.
  const centerOnGeo = (geo: ShapeGeometry) => {
    const { width: vw, height: vh } = viewportSize;
    if (!vw || !vh) return;
    const scale = clamp(zoom.scale, minScale, MAX_ZOOM);
    const cx = geo.x + geo.width / 2;
    const cy = geo.y + geo.height / 2;
    setZoom(clampZoomState({ scale, translateX: vw / 2 - cx * scale, translateY: vh / 2 - cy * scale }, vw, vh, minScale));
  };

  // Vue initiale : cadre tout ce qui est déjà posé dès que le viewport est
  // mesuré, une seule fois (initializedRef) — ne doit pas re-cadrer de force
  // après que l'utilisateur a lui-même zoomé/déplacé la vue. Si l'écran
  // s'ouvre depuis "Voir sur le plan", c'est l'effet suivant qui pilote le
  // cadrage initial à la place de celui-ci.
  useEffect(() => {
    if (initializedRef.current) return;
    if (!viewportSize.width || !viewportSize.height) return;
    if (highlightFormeId) return;
    initializedRef.current = true;
    fitToRooms();
  }, [viewportSize, formes]);

  // Vient de "Voir sur le plan" (fiche Objet) : amène la forme concernée au
  // centre du viewport. `centeredHighlightRef` évite de re-recentrer à
  // chaque re-render tant que highlightFormeId ne change pas réellement.
  useEffect(() => {
    if (!highlightFormeId) return;
    if (centeredHighlightRef.current === highlightFormeId) return;
    if (!viewportSize.width || !viewportSize.height) return;
    const geo = geoById[highlightFormeId];
    if (!geo) return;
    centeredHighlightRef.current = highlightFormeId;
    initializedRef.current = true;
    centerOnGeo(geo);
  }, [highlightFormeId, geoById, viewportSize]);

  // Le bloc "Emplacements non placés" au-dessus du plan apparaît/disparaît
  // selon la sélection, ce qui redimensionne CE viewport bien plus souvent
  // qu'une simple rotation d'écran. Sans ce recalage, un zoom/pan déjà en
  // cours pouvait devenir invalide (glissé au-delà du bord de la feuille, ou
  // sous minScale) dès que le viewport rétrécit ou grandit sans qu'aucun
  // geste ne soit en train de se produire pour le repasser par
  // clampZoomState.
  useEffect(() => {
    if (!initializedRef.current) return;
    if (!viewportSize.width || !viewportSize.height) return;
    setZoom((z) => clampZoomState(z, viewportSize.width, viewportSize.height, minScale));
  }, [viewportSize, minScale]);

  // Pincement = zoomer ET déplacer, comme une visionneuse de photos — pas un
  // zoom scale-only combiné à un Gesture.Pan à deux doigts séparé (ancienne
  // version) : les deux gestes tournant en Simultaneous écrivaient chacun
  // leur propre translateX/Y sans se coordonner, d'où le rendu saccadé/
  // "pas naturel" remonté. `pinchAnchor` capture, au DÉBUT du geste, le
  // point du CONTENU (avant zoom/pan) qui se trouve sous le centre du
  // pincement (event.focalX/focalY) ; à chaque frame, translateX/Y sont
  // recalculés pour que CE MÊME point du contenu reste sous CE MÊME endroit
  // à l'écran. Comme le centre du pincement suit aussi les doigts s'ils se
  // déplacent ensemble (pas seulement s'ils s'écartent/rapprochent), cette
  // unique formule gère à la fois le zoom sous les doigts ET le glissé à
  // deux doigts — plus besoin d'un second geste. La cible du geste à UN
  // doigt (déplacement de pièce/pastille) ne peut jamais s'en confondre :
  // minPointers(1).maxPointers(1) plus bas exclut par le nombre de doigts,
  // pas par une logique de priorité à négocier.
  const pinchAnchor = useRef({ x: 0, y: 0 });

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart((event) => {
      zoomOrigin.current = zoom;
      pinchAnchor.current = {
        x: (event.focalX - zoom.translateX) / zoom.scale,
        y: (event.focalY - zoom.translateY) / zoom.scale,
      };
    })
    .onUpdate((event) => {
      // Le scale est clampé AVANT de calculer translateX/Y (pas seulement
      // par clampZoomState en aval) : une fois MIN_ZOOM/MAX_ZOOM atteint,
      // le contenu doit continuer à suivre le centre du pincement au lieu
      // de figer sa position pendant que l'utilisateur continue de pincer.
      const scale = clamp(zoomOrigin.current.scale * event.scale, minScale, MAX_ZOOM);
      const next = {
        scale,
        translateX: event.focalX - pinchAnchor.current.x * scale,
        translateY: event.focalY - pinchAnchor.current.y * scale,
      };
      setZoom(clampZoomState(next, viewportSize.width, viewportSize.height, minScale));
    });

  // Un point en coordonnées VIEWPORT (écran, avant zoom/pan) devient un point
  // dans le repère du contenu en inversant la transformation appliquée à la
  // vue interne — nécessaire pour savoir si un tap "dans le vide" tombe
  // réellement en dehors de toute pièce.
  const viewportToContent = (vx: number, vy: number) => ({
    x: (vx - zoom.translateX) / zoom.scale,
    y: (vy - zoom.translateY) / zoom.scale,
  });

  useImperativeHandle(ref, () => ({
    getViewportCenter: () => viewportToContent(viewportSize.width / 2, viewportSize.height / 2),
    recenter: () => fitToRooms(),
  }));

  const isInsideAnyRoom = (x: number, y: number) =>
    formes.some((f) => {
      const g = geoById[f.id];
      return x >= g.x && x <= g.x + g.width && y >= g.y && y <= g.y + g.height;
    });

  // Déplacer la vue à UN SEUL DOIGT, y compris pendant qu'une pièce est
  // sélectionnée — tant que le geste part d'ailleurs que de cette pièce.
  //
  // Ce geste était purement et simplement coupé dès qu'une pièce était
  // sélectionnée : il fallait alors deux doigts pour se déplacer, ou
  // désélectionner d'abord. Ce qu'il faut vraiment exclure, ce n'est pas
  // « une pièce est sélectionnée », c'est « ce doigt-là sert déjà à la
  // déplacer ». On regarde donc D'OÙ part le geste.
  //
  // La zone réservée déborde de la pièce de HANDLE_TOUCH_SIZE / 2 : les
  // poignées de redimensionnement sont centrées sur ses coins et ses bords,
  // donc la moitié de leur cible tombe dehors. Sans cette marge, un
  // redimensionnement amorcé un poil en dehors déplaçait aussi le plan.
  // Déplacer la vue à un doigt. Ce qui suit vaut pour les DEUX gestes ci-
  // dessous, qui ne diffèrent que par la vue à laquelle ils sont accrochés.
  const panTheView = (translationX: number, translationY: number) => {
    const next = {
      ...zoomOrigin.current,
      translateX: zoomOrigin.current.translateX + translationX,
      translateY: zoomOrigin.current.translateY + translationY,
    };
    setZoom(clampZoomState(next, viewportSize.width, viewportSize.height, minScale));
  };

  const startViewPan = () => {
    zoomOrigin.current = zoom;
  };

  // UNE SEULE PIÈCE RÉSERVE LE DOIGT : celle qui est sélectionnée, parce
  // qu'il sert alors à la déplacer. Partout ailleurs — le vide, mais AUSSI
  // les autres pièces — le doigt déplace la vue.
  //
  // Cette couche récupère le vide. Elle est posée entre le canevas et toutes
  // les cibles tactiles, donc elle ne voit que les touchers dont personne
  // d'autre ne veut. Les touchers qui tombent sur une pièce NON sélectionnée
  // sont rattrapés par ShapeBody lui-même, qui déplace alors la vue au lieu
  // de la pièce (voir son geste plus bas) — sans quoi il fallait viser une
  // zone vide du plan pour pouvoir se déplacer.
  //
  // Aucun geste concurrent à départager pour un même doigt : c'est toujours
  // la cible la plus haute qui reçoit le toucher, et elle seule.
  const planPan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .runOnJS(true)
    .onStart(startViewPan)
    .onUpdate((event) => panTheView(event.translationX, event.translationY));

  // Remplace le bouton "Valider" : un tap qui ne touche aucune pièce
  // désélectionne. Le calcul en JS (plutôt que de compter sur une priorité
  // de geste implicite) garantit qu'un tap sur une pièce ne désélectionne
  // jamais par erreur, même si ce geste et celui de la pièce touchée
  // observent tous les deux le même toucher.
  const backgroundTap = Gesture.Tap()
    .maxDistance(8)
    .runOnJS(true)
    .onEnd((event) => {
      if (!selectedFormeId) return;
      const point = viewportToContent(event.x, event.y);
      if (!isInsideAnyRoom(point.x, point.y)) onDeselect();
    });

  // Double-tap sur une zone vide du plan (pas sur une pièce — celles-ci ont
  // leur propre double-tap pour ouvrir la fiche, voir ShapeBody) : recentre
  // et zoome pour montrer toutes les pièces d'un coup, l'action "vue
  // d'ensemble" demandée pour naviguer facilement sur un grand plan.
  // `Gesture.Exclusive(backgroundDoubleTap, backgroundTap)` fait attendre le
  // tap simple le temps de voir si un second tap suit, même principe que
  // ShapeBody.
  const backgroundDoubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(12)
    .runOnJS(true)
    .onEnd(() => fitToRooms());
  const backgroundTaps = Gesture.Exclusive(backgroundDoubleTap, backgroundTap);

  // La pièce sélectionnée se dessine en dernier (donc par-dessus) — sans ça,
  // une pièce en cours de glissé/redimensionnement pouvait passer sous une
  // voisine dessinée après elle dans le tableau `formes` (simple ordre de
  // création, sans rapport avec ce qui est en train d'être manipulé).
  const sortedFormes = useMemo(
    () => [...formes].sort((a, b) => (a.id === selectedFormeId ? 1 : 0) - (b.id === selectedFormeId ? 1 : 0)),
    [formes, selectedFormeId],
  );

  // Tout ce dont les quatre passes de dessin ont besoin, resolu UNE fois :
  // les passes parcourent la meme liste, il serait absurde de recalculer la
  // couleur et le libelle de chaque piece a chacune.
  //
  // Couleur : une forme associee a une Piece prend la couleur de CETTE Piece
  // (meme repli DEFAULT_PIECE_COLOR que la liste des Pieces d une Habitation
  // — c est un attribut de la Piece, pas du Plan). Une forme non associee n a
  // pas de Piece dont heriter : elle garde son repli par hash pour rester
  // visuellement distincte de ses voisines.
  const doorsByForme = useMemo(() => {
    const map: Record<string, PlanDoor[]> = {};
    for (const door of doors) (map[door.forme_id] ??= []).push(door);
    return map;
  }, [doors]);

  // La colonne `edge` est un `text` contraint par un CHECK a quatre valeurs :
  // le type genere, lui, ne connait que `string`.
  const doorSpansByForme = useMemo(() => {
    const map: Record<string, { edge: DoorEdge; position: number }[]> = {};
    for (const [formeId, list] of Object.entries(doorsByForme)) {
      map[formeId] = list.map((door) => ({ edge: door.edge as DoorEdge, position: door.position }));
    }
    return map;
  }, [doorsByForme]);

  const roomVisuals = useMemo(
    () =>
      sortedFormes.map((forme) => {
        const info = forme.piece_id ? pieceInfo[forme.piece_id] : undefined;
        const roomDoors = doorSpansByForme[forme.id] ?? [];
        // Les voisines disent deux choses : quels pans de mur sont mitoyens
        // (donc fins), et où le mur commun est déjà percé par elles.
        const neighbours = sortedFormes
          .filter((other) => other.id !== forme.id)
          .map((other) => ({ geo: geoById[other.id], doors: doorSpansByForme[other.id] ?? [] }));
        return {
          id: forme.id,
          geo: geoById[forme.id],
          color: forme.piece_id ? (info?.color ?? DEFAULT_PIECE_COLOR) : roomColorForForme(forme.id),
          label: info?.name ?? "",
          count: forme.piece_id ? (roomCounts?.[forme.piece_id] ?? null) : null,
          selected: forme.id === selectedFormeId,
          // Le mur n'est plus un rectangle mais une suite de segments : les
          // portes de cette pièce y sont des trous, et chaque segment sait
          // s'il ferme le logement (épais) ou sépare deux pièces (fin).
          walls: wallSegments(geoById[forme.id], roomDoors, neighbours),
          jambs: doorJambs(geoById[forme.id], roomDoors, neighbours),
        };
      }),
    [sortedFormes, pieceInfo, geoById, roomCounts, selectedFormeId, doorSpansByForme],
  );

  const selectedDoorGeometry = useMemo(() => {
    const door = doors.find((candidate) => candidate.id === selectedDoorId);
    if (!door) return null;
    const geo = geoById[door.forme_id];
    if (!geo) return null;
    return doorSpan(geo, door.edge as DoorEdge, door.position);
  }, [doors, selectedDoorId, geoById]);

  const previewGeometry = useMemo(() => {
    if (!doorPlacing || !doorPreview) return null;
    const geo = geoById[doorPreview.formeId];
    if (!geo) return null;
    const span = doorSpan(geo, doorPreview.edge, doorPreview.position);
    const neighbours = formes
      .filter((forme) => forme.id !== doorPreview.formeId)
      .map((forme) => ({ geo: geoById[forme.id], doors: doorSpansByForme[forme.id] ?? [] }));
    return {
      span,
      jambs: doorJambs(geo, [{ edge: doorPreview.edge, position: doorPreview.position }], neighbours),
    };
  }, [doorPlacing, doorPreview, geoById, formes, doorSpansByForme]);

  return (
    <View
      style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.sandDark }}
      className="rounded-2xl"
      onLayout={(event) => setViewportSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      <GestureDetector gesture={Gesture.Simultaneous(pinch, backgroundTaps)}>
        {/* Cette vue (non transformée) capte les gestes sur toute la fenêtre
            visible, quel que soit le zoom — voir le commentaire sur
            backgroundPan plus haut. */}
        <View style={{ width: viewportSize.width, height: viewportSize.height }}>
          {/* Le contenu réellement zoomable/déplaçable, LUI, doit couvrir
              toute la FEUILLE (WORLD_WIDTH/HEIGHT), pas seulement la fenêtre
              visible : un Canvas Skia ne peut jamais dessiner en dehors de
              ses propres dimensions, quel que soit le zoom/pan appliqué à un
              parent — le dimensionner à la taille de la fenêtre au lieu de
              la feuille coupait silencieusement toute pièce dépassant la
              largeur d'écran, sans qu'aucun zoom arrière ne puisse jamais le
              révéler. C'était la cause réelle du "mur invisible". */}
          <View
            style={{
              width: WORLD_WIDTH,
              height: WORLD_HEIGHT,
              // Ancre le zoom sur le coin haut-gauche de la feuille (pas le
              // centre, valeur par défaut de RN) : tous les calculs JS
              // (viewportToContent, clampZoomState, fitToBounds...) traitent
              // translateX/Y comme la position écran du point (0,0) de la
              // feuille avant mise à l'échelle — sans ce transformOrigin, le
              // rendu réel (centré par défaut) partirait d'un point différent
              // de celui utilisé par ces calculs.
              transformOrigin: '0 0',
              transform: [{ translateX: zoom.translateX }, { translateY: zoom.translateY }, { scale: zoom.scale }],
            }}
          >
            <Canvas style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }}>
              {/* La feuille elle-même, bien visible (fond clair + bord net)
                  sur le fond plus sombre de la zone déplaçable — pour qu'on
                  voie enfin où s'arrête la zone utile. */}
              <Rect x={0} y={0} width={WORLD_WIDTH} height={WORLD_HEIGHT} color={colors.surface} style="fill" />
              <Rect x={0} y={0} width={WORLD_WIDTH} height={WORLD_HEIGHT} color={colors.inkFaint} style="stroke" strokeWidth={2} />
              {/* TROIS PASSES, et c'est le changement structurant du rendu.
                  Avant, chaque pièce dessinait son fond PUIS son contour, l'une
                  après l'autre : le fond d'une pièce dessinée plus tard passait
                  donc par-dessus le contour de sa voisine, et deux pièces
                  accolées montraient deux traits côte à côte au lieu d'une
                  cloison. En séparant les passes, tous les sols sont posés
                  d'abord, tous les murs ensuite — deux pièces accolées posent
                  leur mur exactement au même endroit et se lisent comme un
                  seul trait. */}

              {/* Passe 1 — les sols */}
              {roomVisuals.map((room) => (
                <Rect
                  key={`fill-${room.id}`}
                  x={room.geo.x}
                  y={room.geo.y}
                  width={room.geo.width}
                  height={room.geo.height}
                  color={room.color}
                  opacity={ROOM_FILL_OPACITY}
                  style="fill"
                />
              ))}

              {/* Passe 2 — les murs, percés de leurs portes et hiérarchisés.
                  Une suite de segments et non plus un rectangle : c'est
                  l'interruption du trait qui FAIT la porte, et c'est le
                  découpage qui permet à un même mur d'être épais là où il
                  ferme le logement et fin là où il longe une voisine. */}
              {roomVisuals.map((room) =>
                room.walls.map((wall, index) => (
                  <Line
                    key={`wall-${room.id}-${index}`}
                    p1={vec(wall.x1, wall.y1)}
                    p2={vec(wall.x2, wall.y2)}
                    color={WALL_COLOR}
                    style="stroke"
                    strokeWidth={wallWidth(wall.interior)}
                  />
                )),
              )}

              {/* Passe 2 ter — les tableaux des portes. Deux traits
                  perpendiculaires aux extrémités de chaque ouverture : sur
                  une cloison de 2 unités, un simple trou se lirait comme un
                  mur mal fermé plutôt que comme un passage. */}
              {roomVisuals.map((room) =>
                room.jambs.map((jamb, index) => (
                  <Line
                    key={`jamb-${room.id}-${index}`}
                    p1={vec(jamb.x1, jamb.y1)}
                    p2={vec(jamb.x2, jamb.y2)}
                    color={WALL_COLOR}
                    style="stroke"
                    strokeWidth={DOOR_JAMB_WIDTH}
                  />
                )),
              )}

              {/* Passe 2 quater — les cibles de pose. Sans elles, la pose se
                  faisait sur des zones invisibles : rien n'annonçait qu'un
                  mur était touchable, ce que le test a immédiatement
                  reproché. Elles n'existent que le temps de la pose. */}
              {doorPlacing
                ? roomVisuals.flatMap((room) =>
                    room.walls.map((wall, index) => (
                      <Line
                        key={`target-${room.id}-${index}`}
                        p1={vec(wall.x1, wall.y1)}
                        p2={vec(wall.x2, wall.y2)}
                        color={ACCENT}
                        opacity={0.35}
                        style="stroke"
                        strokeWidth={16}
                      />
                    )),
                  )
                : null}

              {/* Passe 2 quinquies — l'aperçu sous le doigt. Le trait blanc
                  efface le mur à l'endroit visé, le pointillé montre
                  l'ouverture telle qu'elle sera : on voit la porte AVANT de
                  lâcher, au lieu de la découvrir après. */}
              {previewGeometry ? (
                <>
                  <Line
                    p1={vec(previewGeometry.span.x1, previewGeometry.span.y1)}
                    p2={vec(previewGeometry.span.x2, previewGeometry.span.y2)}
                    color={colors.surface}
                    style="stroke"
                    strokeWidth={WALL_WIDTH + 2}
                  />
                  {previewGeometry.jambs.map((jamb, index) => (
                    <Line
                      key={`preview-jamb-${index}`}
                      p1={vec(jamb.x1, jamb.y1)}
                      p2={vec(jamb.x2, jamb.y2)}
                      color={ACCENT}
                      style="stroke"
                      strokeWidth={2}
                    />
                  ))}
                  <Line
                    p1={vec(previewGeometry.span.x1, previewGeometry.span.y1)}
                    p2={vec(previewGeometry.span.x2, previewGeometry.span.y2)}
                    color={ACCENT}
                    style="stroke"
                    strokeWidth={3}
                  >
                    <DashPathEffect intervals={[7, 5]} />
                  </Line>
                </>
              ) : null}

              {/* Passe 3 — la pièce SÉLECTIONNÉE, au-dessus de tous les murs
                  pour ne jamais être coupée par la voisine.
                  « Voir sur le plan » ne dessine plus rien ici : le cadre
                  vert autour de la pièce doublait la puce mise en avant, pour
                  une seule et même réponse. */}
              {roomVisuals.map((room) =>
                room.selected
                  ? // Les MÊMES segments que le mur, pas un rectangle plein :
                    // sinon le liseré reboucherait les ouvertures de la pièce
                    // en cours d'édition, seule pièce où l'on a justement
                    // besoin de les voir. L'épaisseur suit celle du segment
                    // souligné, sans quoi le liseré d'une cloison fine
                    // ressemblerait à une façade.
                    room.walls.map((wall, index) => (
                      <Line
                        key={`state-${room.id}-${index}`}
                        p1={vec(wall.x1, wall.y1)}
                        p2={vec(wall.x2, wall.y2)}
                        color={ACCENT}
                        style="stroke"
                        strokeWidth={wallWidth(wall.interior) + 1.5}
                      />
                    ))
                  : null,
              )}

              {/* Passe 3 bis — la porte sélectionnée. L'ouverture est un
                  VIDE : sans ce trait, rien ne distingue la porte qu'on
                  vient de désigner de ses voisines, et la barre d'action du
                  bas parlerait d'un objet invisible. */}
              {selectedDoorGeometry ? (
                <Line
                  p1={vec(selectedDoorGeometry.x1, selectedDoorGeometry.y1)}
                  p2={vec(selectedDoorGeometry.x2, selectedDoorGeometry.y2)}
                  color={ACCENT}
                  style="stroke"
                  strokeWidth={WALL_WIDTH + 2}
                />
              ) : null}

              {/* Passe 4 — les libellés, toujours au-dessus */}
              {roomVisuals.map((room) => (
                <RoomLabel
                  key={`label-${room.id}`}
                  geo={room.geo}
                  label={room.label}
                  count={room.count}
                  font={font}
                  countFont={countFont}
                />
              ))}
            </Canvas>

            {/* La couche de déplacement à un doigt. Posée ici, entre le
                canevas et toutes les cibles tactiles, elle ne récupère que
                les touchers tombés en dehors d'elles. */}
            <GestureDetector gesture={planPan}>
              <View style={{ position: 'absolute', left: 0, top: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }} />
            </GestureDetector>

            {/* Pendant la pose d'une porte, le corps des pièces et les
                poignées disparaissent : un seul type de cible à l'écran,
                donc aucun geste à départager. C'est ce qui manquait à la
                première version. */}
            {doorPlacing ? null : formes.map((forme) => {
              const geo = geoById[forme.id];
              const isSelected = forme.id === selectedFormeId;
              const others = formes.filter((f) => f.id !== forme.id).map((f) => geoById[f.id]);
              return (
                <ShapeBody
                  key={forme.id}
                  geo={geo}
                  others={others}
                  isSelected={isSelected}
                  readOnly={readOnly}
                  scale={zoom.scale}
                  onMove={(x, y) => setShapes((current) => ({ ...current, [forme.id]: { ...current[forme.id], x, y } }))}
                  onDragEnd={(x, y) => onDragEnd(forme.id, x, y)}
                  onSelect={() => onSelect(forme)}
                  onViewPanStart={startViewPan}
                  onViewPan={panTheView}
                />
              );
            })}

            {/* Après ShapeBody (appuyer sur un mur perce une porte plutôt
                que de resélectionner la pièce) mais AVANT les poignées de
                redimensionnement, qui gardent la priorité aux coins et au
                milieu de chaque mur. */}
            <DoorLayer
              doors={doors}
              formeGeo={geoById}
              placing={doorPlacing}
              selectedDoorId={selectedDoorId}
              scale={zoom.scale}
              readOnly={readOnly}
              onCreate={onDoorCreate}
              onPreview={setDoorPreview}
              onSelect={onDoorSelect}
              onDragEnd={onDoorDragEnd}
            />

            {/* Poignées de redimensionnement : pas rendues du tout en
                consultation, plutôt que rendues et inertes — une poignée
                visible qui ne répond pas se lit comme un bug. */}
            {selectedForme && !readOnly && !doorPlacing
              ? HANDLES.map((handle) => (
                  <HandleDot
                    key={handle}
                    geo={geoById[selectedForme.id]}
                    handle={handle}
                    others={formes.filter((f) => f.id !== selectedForme.id).map((f) => geoById[f.id])}
                    scale={zoom.scale}
                    onResize={(geometry) => setShapes((current) => ({ ...current, [selectedForme.id]: geometry }))}
                    onResizeEnd={(geometry) => onResizeEnd(selectedForme.id, geometry.x, geometry.y, geometry.width, geometry.height)}
                  />
                ))
              : null}

            <PlanPinLayer
              pins={pins}
              formeGeo={geoById}
              pinDisplay={pinDisplay}
              selectedFormeId={selectedFormeId}
              highlightedEmplacementId={highlightEmplacementId}
              scale={zoom.scale}
              size={pinSize}
              selectedPinId={selectedPinId}
              onSelectPin={onPinSelect}
              readOnly={readOnly}
              onDragEnd={onPinDragEnd}
              onTap={onPinTap}
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
});

// Rectangle plein (couleur par pièce individuelle) + contour + nom centré —
// plan 2D top-down pur, aucune projection. `highlighted` (vient de "Voir sur
// le plan") NE change PAS le remplissage (la pièce garde sa couleur normale,
// lisibilité du plan dans son ensemble préservée) — seul le contour devient
// vert et plus épais. `selected` (édition en cours) prend le pas en corail
// si les deux sont vrais en même temps (cas rare : la pièce surlignée est
// aussi celle qu'on édite).
/**
 * Largeur réelle d'un texte, pour le centrer POUR DE VRAI.
 *
 * L'ancien rendu approximait avec `x = centre - longueur * 3`, ce qui décalait
 * chaque nom d'autant plus qu'il était long ou court ("Salle de bain" et "WC"
 * ne tombaient pas au même endroit). Le repli sur cette approximation ne sert
 * qu'au cas où la police n'expose pas de mesure.
 */
function measureWidth(font: SkFont, text: string): number {
  try {
    return font.measureText(text).width;
  } catch {
    return text.length * 6;
  }
}

/**
 * Nom de la pièce + nombre d'objets, centrés dans la pièce.
 *
 * ⚠️ Skia place le `y` d'un Text sur sa LIGNE DE BASE, pas sur son centre.
 * L'ancien rendu passait le centre vertical de la pièce directement, ce qui
 * faisait flotter tous les noms trop bas. On remonte donc d'environ un tiers
 * de la taille de police pour retrouver un centrage optique.
 */
function RoomLabel({
  geo,
  label,
  count,
  font,
  countFont,
}: {
  geo: ShapeGeometry;
  label: string;
  count: number | null;
  font: SkFont | null;
  countFont: SkFont | null;
}) {
  if (!label || !font) return null;

  const centerX = geo.x + geo.width / 2;
  const centerY = geo.y + geo.height / 2;
  const hasCount = count !== null && countFont !== null;

  // Avec un compte, le bloc fait deux lignes : on remonte le nom pour que
  // l'ENSEMBLE reste centré, plutôt que le nom seul.
  const nameBaseline = hasCount ? centerY : centerY + 4;

  return (
    <>
      <SkiaText
        x={centerX - measureWidth(font, label) / 2}
        y={nameBaseline}
        text={label}
        font={font}
        color="#2D2A26"
      />
      {hasCount && countFont ? (
        <SkiaText
          x={centerX - measureWidth(countFont, formatCount(count)) / 2}
          y={centerY + 13}
          text={formatCount(count)}
          font={countFont}
          color="#6B6459"
        />
      ) : null}
    </>
  );
}

function formatCount(count: number): string {
  return count === 1 ? '1 objet' : `${count} objets`;
}

// Le corps d'une pièce. Un tap la sélectionne, toujours — y compris pendant
// qu'une autre l'est, pour passer de l'une à l'autre sans rien valider.
//
// LE GLISSÉ, LUI, DÉPEND DE LA SÉLECTION. Sur la pièce sélectionnée il la
// déplace (avec snapPosition, qui l'accole magnétiquement à ses voisines) ;
// sur toutes les autres il déplace LA VUE, exactement comme le vide autour.
//
// Ce second cas manquait : le geste était simplement désactivé, et une pièce
// non sélectionnée avalait donc le toucher sans rien en faire. Il fallait
// viser une zone vide du plan pour pouvoir se déplacer — ce que le test a
// reproché. C'est bien ici que ça se règle et pas sur une couche du dessous :
// une vue posée par-dessus les pièces leur volerait le tap de sélection.
function ShapeBody({
  geo,
  others,
  isSelected,
  readOnly,
  scale,
  onMove,
  onDragEnd,
  onSelect,
  onViewPanStart,
  onViewPan,
}: {
  geo: ShapeGeometry;
  others: ShapeGeometry[];
  isSelected: boolean;
  readOnly?: boolean;
  scale: number;
  onMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onSelect: () => void;
  onViewPanStart: () => void;
  onViewPan: (translationX: number, translationY: number) => void;
}) {
  const dragOrigin = useRef(geo);
  const HIT_SLOP = 12;
  const movesTheRoom = isSelected && !readOnly;

  // event.translation(X|Y) est un delta ÉCRAN, avant mise à l'échelle du
  // zoom — diviser par `scale` pour obtenir le déplacement réel dans le
  // repère (non zoomé) où vivent x/y.
  const resolve = (translationX: number, translationY: number) => {
    const rawX = dragOrigin.current.x + translationX / scale;
    const rawY = dragOrigin.current.y + translationY / scale;
    const snapped = snapPosition(rawX, rawY, geo.width, geo.height, others);
    return clampPositionToWorld(snapped.x, snapped.y, geo.width, geo.height);
  };

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = geo;
      if (!movesTheRoom) onViewPanStart();
    })
    .onUpdate((event) => {
      if (!movesTheRoom) {
        onViewPan(event.translationX, event.translationY);
        return;
      }
      const snapped = resolve(event.translationX, event.translationY);
      onMove(snapped.x, snapped.y);
    })
    .onEnd((event) => {
      if (!movesTheRoom) return;
      const snapped = resolve(event.translationX, event.translationY);
      onDragEnd(snapped.x, snapped.y);
    });

  // UN SEUL TAP, ET C'EST TOUT. La fiche d'édition s'ouvrait au DOUBLE-tap :
  // un geste que rien n'annonçait à l'écran, et une vraie difficulté motrice
  // passé un certain âge — or l'objectif est que le plan reste utilisable à
  // tout âge. Le tap simple sélectionne, et c'est la barre d'action en bas
  // d'écran (voir plan/[id].tsx) qui donne accès à l'édition : une cible
  // large, visible, sans geste à deviner.
  //
  // Il reste actif en consultation : il ne modifie rien et sert à mettre une
  // pièce en évidence.
  const singleTap = Gesture.Tap().numberOfTaps(1).hitSlop(HIT_SLOP).runOnJS(true).onEnd(() => onSelect());
  const gesture = Gesture.Exclusive(pan, singleTap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: 'absolute', left: geo.x, top: geo.y, width: geo.width, height: geo.height }} />
    </GestureDetector>
  );
}

// 44px : le minimum recommandé pour une cible tactile. Les 32px précédents
// étaient en dessous, et redimensionner une pièce demandait de viser.
const HANDLE_TOUCH_SIZE = 44;
const HANDLE_DOT_SIZE = 18;

// Petit point d'ancrage — sa propre zone de geste (32x32, centrée sur le
// point), rendu par-dessus ShapeBody pour que le toucher y soit prioritaire
// à cet endroit précis plutôt que d'aller au déplacement. Le redimensionnement
// passe par snapResize() pour aligner le bord actif sur une pièce voisine.
function HandleDot({
  geo,
  handle,
  others,
  scale,
  onResize,
  onResizeEnd,
}: {
  geo: ShapeGeometry;
  handle: HandleId;
  others: ShapeGeometry[];
  scale: number;
  onResize: (geometry: ShapeGeometry) => void;
  onResizeEnd: (geometry: ShapeGeometry) => void;
}) {
  const origin = useRef(geo);
  const last = useRef(geo);
  const anchor = handleAnchor(geo, handle);

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .runOnJS(true)
    .onStart(() => {
      origin.current = geo;
      last.current = geo;
    })
    .onUpdate((event) => {
      const raw = applyHandle(origin.current, handle, event.translationX / scale, event.translationY / scale);
      last.current = clampResizeToWorld(snapResize(raw, handle, others));
      onResize(last.current);
    })
    .onEnd(() => onResizeEnd(last.current));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          position: 'absolute',
          left: anchor.x - HANDLE_TOUCH_SIZE / 2,
          top: anchor.y - HANDLE_TOUCH_SIZE / 2,
          width: HANDLE_TOUCH_SIZE,
          height: HANDLE_TOUCH_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: HANDLE_DOT_SIZE,
            height: HANDLE_DOT_SIZE,
            borderRadius: HANDLE_DOT_SIZE / 2,
            backgroundColor: '#1591EA',
            borderWidth: 2,
            borderColor: '#fff',
          }}
        />
      </View>
    </GestureDetector>
  );
}
