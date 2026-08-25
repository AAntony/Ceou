import { Canvas, DashPathEffect, Line, Rect, vec } from '@shopify/react-native-skia';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { IconName } from '../../components/Icon';
import { DEFAULT_PIECE_COLOR } from '../inventory/constants';
import type { PlanDoor, PlanForme, PlanPin } from '../../types/database';
import {
  DOOR_JAMB_WIDTH,
  DOOR_TARGET,
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
import { hitTestPlan, type PlanTarget, type PlanTargets } from './hitTest';
import { PlanPinLayer } from './PlanPinLayer';
import { PIN_METRICS, type PinMetrics, type PinSize } from './pinSize';
import { doorCenter, doorJambs, doorSpan, freeDoorPosition, nearestEdge, wallSegments, wallWidth } from './walls';
import type { DoorEdge } from './types';
import { clamp, clampPositionToWorld, clampResizeToWorld, clampSize, resolvePinRel, snapPosition, snapResize, snapToSiblings } from './snap';
import type { HandleId, ShapeGeometry } from './types';
import { useTextScale } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';

const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// Taille du nom d'une pièce et de son compteur, EN PIXELS D'ÉCRAN : le calque
// des étiquettes vit hors du monde zoomé (voir RoomLabelLayer), ces valeurs ne
// dépendent donc pas du zoom. Multipliées par le réglage d'affichage du
// Profil, comme le reste des textes de l'app.
const LABEL_FONT_SIZE = 14;
const COUNT_FONT_SIZE = 11;
/** Espace laissé entre le mur du haut et le sommet des lettres, en pixels d'écran. */
const LABEL_TOP_CLEARANCE = 6;

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
  // Le nom des pièces suit le réglage d'affichage, maintenant qu'il a une
  // taille d'écran à lui (avant, il était dans le monde zoomé, où le seul
  // réglage qui comptait était le zoom). C'est `factor` et non `textScale` :
  // le nom est rendu par un `Text` de React Native, qui applique déjà de son
  // côté le réglage de police du téléphone — utiliser `textScale`, qui
  // contient les deux, le compterait deux fois.
  const { factor: textFactor } = useTextScale();
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
  // DEUX ROLES, DEUX SUPPORTS, et ce n'est pas une redondance :
  //  - la ref garde « le cadrage a deja ete decide », lue et posee dans le
  //    meme tour de boucle (un etat y serait perime) ;
  //  - l'etat autorise la PEINTURE, et doit donc declencher un rendu.
  // Les deux sont poses ensemble, aux trois endroits qui decident du cadrage.
  const initializedRef = useRef(false);
  const [framed, setFramed] = useState(false);
  const centeredHighlightRef = useRef<string | null>(null);

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

  // CALCUL PUR, sans état : quel zoom cadre cette zone du monde dans un
  // viewport de cette taille. Séparé de la pose du zoom parce que le cadrage
  // INITIAL doit être décidé au moment même où l'on apprend la taille du
  // viewport — dans le gestionnaire onLayout, où `viewportSize` n'est pas
  // encore à jour. Voir handleLayout.
  const zoomForBounds = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    padding: number,
    vw: number,
    vh: number,
  ): ZoomState => {
    const fitScale = Math.min(vw / WORLD_WIDTH, vh / WORLD_HEIGHT);
    const boundsW = Math.max(maxX - minX, 1);
    const boundsH = Math.max(maxY - minY, 1);
    const availW = Math.max(vw - padding * 2, 1);
    const availH = Math.max(vh - padding * 2, 1);
    const scale = clamp(Math.min(availW / boundsW, availH / boundsH), fitScale, MAX_ZOOM);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return clampZoomState({ scale, translateX: vw / 2 - cx * scale, translateY: vh / 2 - cy * scale }, vw, vh, fitScale);
  };

  // Bornes de tout ce qui est posé sur le plan — ou la feuille entière quand
  // il n'y a encore rien.
  const roomsBounds = () => {
    if (formes.length === 0) return { minX: 0, minY: 0, maxX: WORLD_WIDTH, maxY: WORLD_HEIGHT, padding: 0 };
    const geos = formes.map((f) => geoById[f.id]);
    return {
      minX: Math.min(...geos.map((g) => g.x)),
      minY: Math.min(...geos.map((g) => g.y)),
      maxX: Math.max(...geos.map((g) => g.x + g.width)),
      maxY: Math.max(...geos.map((g) => g.y + g.height)),
      padding: 48,
    };
  };

  // Recentre/zoome sur une zone du monde (unités feuille), avec une marge en
  // pixels écran — base commune à la vue initiale et au double-tap "tout
  // voir" (fitToRooms plus bas).
  const fitToBounds = (minX: number, minY: number, maxX: number, maxY: number, padding: number) => {
    const { width: vw, height: vh } = viewportSize;
    if (!vw || !vh) return;
    setZoom(zoomForBounds(minX, minY, maxX, maxY, padding, vw, vh));
  };

  // Cadre toutes les pièces déjà posées (ou toute la feuille s'il n'y en a
  // aucune) : vue initiale à l'ouverture de l'écran ET action du double-tap
  // sur une zone vide du plan (backgroundDoubleTap plus bas) — "montre-moi
  // tout le plan d'un coup" plutôt qu'un simple retour à un zoom fixe.
  const fitToRooms = () => {
    const b = roomsBounds();
    fitToBounds(b.minX, b.minY, b.maxX, b.maxY, b.padding);
  };

  // LE CADRAGE INITIAL EST DÉCIDÉ DANS LE MÊME ÉVÉNEMENT QUE LA MESURE.
  //
  // Il passait auparavant par un effet, déclenché APRÈS le rendu qui suit la
  // mesure : le canevas peignait donc une image au zoom 1 — pièces et puces
  // trois fois trop grandes sur un téléphone — avant de se recadrer à
  // l'image suivante. Invisible à l'ouverture d'un plan, où la transition
  // d'écran la recouvre ; parfaitement visible en changeant d'étage, où le
  // canevas est remonté sans transition (retour utilisateur du 2026-08-26).
  //
  // Poser la taille du viewport ET le zoom dans le même gestionnaire les
  // regroupe en un seul rendu : la première image peinte est déjà la bonne.
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewportSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
    if (initializedRef.current) return;
    if (!width || !height) return;
    // « Voir sur le plan » vise une pièce précise : c'est l'effet dédié qui
    // pilote le cadrage dans ce cas, pas celui-ci.
    if (highlightFormeId) return;
    initializedRef.current = true;
    setFramed(true);
    const b = roomsBounds();
    setZoom(zoomForBounds(b.minX, b.minY, b.maxX, b.maxY, b.padding, width, height));
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

  // FILET, pas chemin principal : le cadrage initial est posé par
  // handleLayout, dans le même rendu que la mesure. Cet effet ne sert que si
  // le viewport a été mesuré avant que les pièces ne soient là — le canevas
  // aurait alors cadré la feuille vide, ce qui ne montre rien d'utile.
  useEffect(() => {
    if (initializedRef.current) return;
    if (!viewportSize.width || !viewportSize.height) return;
    if (highlightFormeId) return;
    initializedRef.current = true;
    setFramed(true);
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
    setFramed(true);
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

  // Le pincement garde la main sur `zoomOrigin`, que les deux gestes du
  // conteneur partagent : un second doigt posé pendant un glissé faisait
  // repartir celui-ci de l'origine que le pincement venait d'inscrire, et les
  // deux se disputaient la vue à chaque frame.
  //
  // Pour tout ce qui se déplace SOUS le doigt — pièce, poignée, puce, porte —
  // ce n'est plus ce drapeau qui protège, mais `numberOfPointers`, lu par le
  // glissé unique lui-même : n'ayant plus de `maxPointers`, il reste vivant
  // pendant le pincement et voit donc le second doigt arriver.
  const pinching = useRef(false);

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onTouchesDown((event) => {
      if (event.numberOfTouches >= 2) pinching.current = true;
    })
    .onStart((event) => {
      pinching.current = true;
      zoomOrigin.current = zoom;
      pinchAnchor.current = {
        x: (event.focalX - zoom.translateX) / zoom.scale,
        y: (event.focalY - zoom.translateY) / zoom.scale,
      };
    })
    .onFinalize(() => {
      pinching.current = false;
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

  // === UN SEUL GLISSÉ POUR TOUT LE PLAN ===================================
  //
  // Déplacer la vue, déplacer une pièce, la redimensionner, glisser une puce
  // ou une porte : c'est LE MÊME geste, posé sur le conteneur, dans la même
  // composition que le pincement. Ce qu'il manipule se décide en JS au moment
  // où le doigt se pose (hitTestPlan).
  //
  // C'est l'aboutissement de trois corrections ratées. Tant que chaque pièce,
  // poignée, puce et porte portait son propre geste, il fallait arbitrer : un
  // geste d'enfant coupe celui de l'ancêtre en s'activant, ce qui tuait le
  // pincement, et le rétablir demandait des relations croisées entre
  // composants — invérifiables d'ici, et fausses en pratique.
  //
  // Ici il n'y a plus rien à arbitrer. Un seul glissé, un seul pincement,
  // déclarés simultanés au même endroit : ils ne se coupent jamais, et le
  // glissé reste donc VIVANT pendant tout le pincement. C'est ce qui permet
  // enfin de lire `numberOfPointers` et de savoir, à chaque frame, qu'un
  // second doigt s'est posé.
  const panTheView = (translationX: number, translationY: number) => {
    const next = {
      ...zoomOrigin.current,
      translateX: zoomOrigin.current.translateX + translationX,
      translateY: zoomOrigin.current.translateY + translationY,
    };
    setZoom(clampZoomState(next, viewportSize.width, viewportSize.height, minScale));
  };

  // Ce qu'une puce ou une porte vaut PENDANT qu'on la glisse, et jusqu'à ce
  // que le serveur l'ait confirmé. Les couches d'affichage n'ont plus d'état
  // propre : elles dessinent la valeur du serveur, sauf pour celle-ci.
  //
  // L'effet plus bas efface l'override dès que le serveur annonce la même
  // valeur. Sans lui il faudrait le retirer à la fin du geste, et la puce
  // reviendrait visiblement à son ancienne place le temps du rechargement.
  const [livePin, setLivePin] = useState<{ id: string; relX: number; relY: number } | null>(null);
  const [liveDoor, setLiveDoor] = useState<{ id: string; edge: DoorEdge; position: number } | null>(null);

  useEffect(() => {
    if (!livePin) return;
    const pin = pins.find((candidate) => candidate.id === livePin.id);
    if (!pin) {
      setLivePin(null);
      return;
    }
    if (Math.abs(pin.rel_x - livePin.relX) < 0.0005 && Math.abs(pin.rel_y - livePin.relY) < 0.0005) setLivePin(null);
  }, [pins, livePin]);

  useEffect(() => {
    if (!liveDoor) return;
    const door = doors.find((candidate) => candidate.id === liveDoor.id);
    if (!door) {
      setLiveDoor(null);
      return;
    }
    if (door.edge === liveDoor.edge && Math.abs(door.position - liveDoor.position) < 0.0005) setLiveDoor(null);
  }, [doors, liveDoor]);

  const panTargets = useMemo<PlanTargets>(() => {
    const selectedGeo = selectedFormeId ? geoById[selectedFormeId] : null;
    if (readOnly || doorPlacing || !selectedGeo || !selectedFormeId) {
      // Rien n'est manipulable : le doigt ne peut que déplacer la vue.
      return { handles: [], pins: [], doors: [], room: null };
    }
    const metrics = PIN_METRICS[pinSize];
    return {
      handles: HANDLES.map((handle) => ({
        handle,
        ...handleAnchor(selectedGeo, handle),
        radius: HANDLE_TOUCH_SIZE / 2,
      })),
      pins: pins
        .filter((pin) => pin.forme_id === selectedFormeId)
        .map((pin) => ({
          id: pin.id,
          x: selectedGeo.x + (livePin?.id === pin.id ? livePin.relX : pin.rel_x) * selectedGeo.width,
          y: selectedGeo.y + (livePin?.id === pin.id ? livePin.relY : pin.rel_y) * selectedGeo.height,
          halfWidth: metrics.cardWidth / 2,
          halfHeight: metrics.cardHeight / 2,
        })),
      // Toutes les portes du plan, pas seulement celles de la pièce
      // sélectionnée : une porte se glisse dès qu'elle est désignée.
      doors: doors.flatMap((door) => {
        const geo = geoById[door.forme_id];
        if (!geo || door.id !== selectedDoorId) return [];
        const live = liveDoor?.id === door.id ? liveDoor : null;
        const center = doorCenter(geo, (live?.edge ?? door.edge) as DoorEdge, live?.position ?? door.position);
        return [{ id: door.id, x: center.x, y: center.y, radius: DOOR_TARGET / 2 }];
      }),
      room: { formeId: selectedFormeId, geo: selectedGeo },
    };
  }, [readOnly, doorPlacing, selectedFormeId, geoById, pins, pinSize, doors, selectedDoorId, livePin, liveDoor]);

  const panTarget = useRef<PlanTarget>({ kind: 'view' });
  // Le geste a-t-il vu un second doigt ? Tant que oui, plus rien ne se
  // déplace, et à la fin tout revient d'où ça vient sans être enregistré.
  const panWentMultiTouch = useRef(false);
  const roomOrigin = useRef<ShapeGeometry | null>(null);
  const roomLive = useRef<ShapeGeometry | null>(null);
  const pinOrigin = useRef<{ id: string; relX: number; relY: number } | null>(null);
  const doorOrigin = useRef<{ id: string; edge: DoorEdge; position: number } | null>(null);

  // Retient d'où part ce qu'on va glisser, pour pouvoir l'y ramener.
  const primeDrag = (target: PlanTarget) => {
    roomOrigin.current = null;
    pinOrigin.current = null;
    doorOrigin.current = null;
    if (target.kind === 'room' || target.kind === 'handle') {
      const geo = selectedFormeId ? geoById[selectedFormeId] : null;
      if (!geo) return;
      roomOrigin.current = geo;
      roomLive.current = geo;
    } else if (target.kind === 'pin') {
      const pin = pins.find((candidate) => candidate.id === target.pinId);
      if (!pin) return;
      const live = livePin?.id === pin.id ? livePin : null;
      pinOrigin.current = { id: pin.id, relX: live?.relX ?? pin.rel_x, relY: live?.relY ?? pin.rel_y };
    } else if (target.kind === 'door') {
      const door = doors.find((candidate) => candidate.id === target.doorId);
      if (!door) return;
      const live = liveDoor?.id === door.id ? liveDoor : null;
      doorOrigin.current = {
        id: door.id,
        edge: (live?.edge ?? door.edge) as DoorEdge,
        position: live?.position ?? door.position,
      };
    }
  };

  const applyDrag = (target: PlanTarget, translationX: number, translationY: number) => {
    // translation est un delta ÉCRAN : le diviser par l'échelle donne le
    // déplacement dans le repère de la feuille, où vivent toutes les
    // géométries. Le déplacement de la VUE, lui, travaille bien en pixels.
    const dx = translationX / zoom.scale;
    const dy = translationY / zoom.scale;

    if (target.kind === 'view') {
      panTheView(translationX, translationY);
      return;
    }

    if (target.kind === 'room') {
      const origin = roomOrigin.current;
      if (!origin) return;
      const others = formes.filter((f) => f.id !== target.formeId).map((f) => geoById[f.id]);
      const snapped = snapPosition(origin.x + dx, origin.y + dy, origin.width, origin.height, others);
      const bounded = clampPositionToWorld(snapped.x, snapped.y, origin.width, origin.height);
      roomLive.current = { ...origin, x: bounded.x, y: bounded.y };
      setShapes((current) => ({ ...current, [target.formeId]: roomLive.current as ShapeGeometry }));
      return;
    }

    if (target.kind === 'handle') {
      const origin = roomOrigin.current;
      if (!origin || !selectedFormeId) return;
      const others = formes.filter((f) => f.id !== selectedFormeId).map((f) => geoById[f.id]);
      const raw = applyHandle(origin, target.handle, dx, dy);
      roomLive.current = clampResizeToWorld(snapResize(raw, target.handle, others));
      setShapes((current) => ({ ...current, [selectedFormeId]: roomLive.current as ShapeGeometry }));
      return;
    }

    if (target.kind === 'pin') {
      const origin = pinOrigin.current;
      const pin = pins.find((candidate) => candidate.id === target.pinId);
      const geo = pin ? geoById[pin.forme_id] : null;
      if (!origin || !pin || !geo) return;
      const metrics = PIN_METRICS[pinSize];
      const siblings = pins
        .filter((candidate) => candidate.forme_id === pin.forme_id && candidate.id !== pin.id)
        .map((candidate) => ({
          x: geo.x + candidate.rel_x * geo.width,
          y: geo.y + candidate.rel_y * geo.height,
        }));
      const snapped = snapToSiblings(
        geo.x + origin.relX * geo.width + dx,
        geo.y + origin.relY * geo.height + dy,
        siblings,
        metrics.cardWidth,
        metrics.cardHeight,
      );
      const margin = metrics.cardHeight / 2;
      setLivePin({
        id: pin.id,
        relX: resolvePinRel((snapped.x - geo.x) / geo.width, geo.width, margin),
        relY: resolvePinRel((snapped.y - geo.y) / geo.height, geo.height, margin),
      });
      return;
    }

    const origin = doorOrigin.current;
    const door = doors.find((candidate) => candidate.id === target.doorId);
    const geo = door ? geoById[door.forme_id] : null;
    if (!origin || !door || !geo) return;
    const from = doorCenter(geo, origin.edge, origin.position);
    const aimed = nearestEdge(from.x + dx, from.y + dy, geo);
    const free = freeDoorPosition(
      geo,
      aimed.edge,
      aimed.position,
      // Sans s'exclure elle-même, la porte se bloquerait sur sa propre place
      // dès le premier millimètre de glissé.
      (doorsByForme[door.forme_id] ?? [])
        .filter((candidate) => candidate.id !== door.id)
        .map((candidate) => ({ edge: candidate.edge as DoorEdge, position: candidate.position })),
      // Les voisines comptent : sur un mur mitoyen, les deux pièces tracent
      // le même trait.
      formes
        .filter((f) => f.id !== door.forme_id)
        .map((f) => ({
          geo: geoById[f.id],
          doors: (doorsByForme[f.id] ?? []).map((d) => ({ edge: d.edge as DoorEdge, position: d.position })),
        })),
    );
    if (free === null) return;
    setLiveDoor({ id: door.id, edge: aimed.edge, position: free });
  };

  // Le geste s'est transformé en pincement : tout revient d'où ça vient, et
  // rien n'est enregistré.
  const revertDrag = (target: PlanTarget) => {
    if (target.kind === 'room' || target.kind === 'handle') {
      const origin = roomOrigin.current;
      if (!origin || !selectedFormeId) return;
      roomLive.current = origin;
      setShapes((current) => ({ ...current, [selectedFormeId]: origin }));
    } else if (target.kind === 'pin') {
      setLivePin(null);
    } else if (target.kind === 'door') {
      setLiveDoor(null);
    }
  };

  const commitDrag = (target: PlanTarget) => {
    if (target.kind === 'room' || target.kind === 'handle') {
      const geometry = roomLive.current;
      if (!geometry || !selectedFormeId) return;
      if (target.kind === 'room') onDragEnd(selectedFormeId, geometry.x, geometry.y);
      else onResizeEnd(selectedFormeId, geometry.x, geometry.y, geometry.width, geometry.height);
    } else if (target.kind === 'pin' && livePin) {
      onPinDragEnd(livePin.id, livePin.relX, livePin.relY);
    } else if (target.kind === 'door' && liveDoor) {
      onDoorDragEnd(liveDoor.id, liveDoor.edge, liveDoor.position);
    }
  };

  const pan = Gesture.Pan()
    .minPointers(1)
    // PAS de maxPointers : le geste doit rester vivant quand le second doigt
    // se pose, justement pour s'en apercevoir. Il devient alors inerte, et le
    // pincement — simultané — fait son travail.
    .runOnJS(true)
    .onStart((event) => {
      panWentMultiTouch.current = false;
      zoomOrigin.current = zoom;
      const point = viewportToContent(event.x, event.y);
      panTarget.current = hitTestPlan(point, panTargets);
      primeDrag(panTarget.current);
    })
    .onUpdate((event) => {
      // UNE FOIS QU'UN SECOND DOIGT S'EST POSÉ, ce geste ne bouge plus rien
      // jusqu'à son terme. Rendre la main en repassant à un doigt — ce qui
      // arrive dès qu'on relâche un pincement — emporterait la pièce avec le
      // doigt restant.
      if (panWentMultiTouch.current) return;
      if (event.numberOfPointers > 1) {
        panWentMultiTouch.current = true;
        revertDrag(panTarget.current);
        return;
      }
      applyDrag(panTarget.current, event.translationX, event.translationY);
    })
    .onEnd(() => {
      if (panWentMultiTouch.current) {
        revertDrag(panTarget.current);
        return;
      }
      commitDrag(panTarget.current);
    });

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
      onLayout={handleLayout}
    >
      <GestureDetector gesture={Gesture.Simultaneous(pinch, Gesture.Exclusive(pan, backgroundTaps))}>
        {/* Cette vue (non transformée) capte les gestes sur toute la fenêtre
            visible, quel que soit le zoom — voir le commentaire sur
            backgroundPan plus haut. */}
        <View style={{ width: viewportSize.width, height: viewportSize.height }}>
          {/* ⚠️ RIEN N'EST PEINT AVANT LA MESURE. C'est la seule chose qui
              empêche l'image fautive, et elle n'est pas décorative.

              Le zoom démarre à l'échelle 1, et n'est cadré qu'une fois le
              viewport mesuré. Or `onLayout` arrive APRÈS la première peinture :
              sans ce garde-fou, le canevas peignait donc une image entière à
              l'échelle 1 — trois fois trop grande sur un téléphone — avant de
              se recadrer. Les pièces y passaient pour un zoom, mais les puces
              d'Emplacement, qui sont des cartes avec icône et texte, sautaient
              franchement (retour utilisateur du 2026-08-26).

              La vue parente est bien en `overflow: hidden`, mais celle-ci fait
              0x0 tant que rien n'est mesuré : son contenu débordait donc
              simplement par-dessus, visible.

              Une fois mesuré, `handleLayout` a posé la taille ET le cadrage
              dans le même rendu : la première image peinte est déjà la bonne. */}
          {framed ? (
          <>
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

              {/* Les noms de pièces ne sont plus peints ici : le canevas ne
                  peut RIEN faire passer devant les puces d'Emplacement, qui
                  sont des vues natives rendues après lui. Ils vivent
                  maintenant dans un calque à part, tout en bas de ce fichier
                  (RoomLabelLayer). */}
            </Canvas>

            {/* Pendant la pose d'une porte, le corps des pièces et les
                poignées disparaissent : un seul type de cible à l'écran,
                donc aucun geste à départager. C'est ce qui manquait à la
                première version. */}
            {doorPlacing
              ? null
              : formes.map((forme) => (
                  <ShapeBody key={forme.id} geo={geoById[forme.id]} onSelect={() => onSelect(forme)} />
                ))}

            {/* Après ShapeBody (appuyer sur un mur perce une porte plutôt
                que de resélectionner la pièce) mais AVANT les poignées de
                redimensionnement, qui gardent la priorité aux coins et au
                milieu de chaque mur. */}
            <DoorLayer
              doors={doors}
              formeGeo={geoById}
              placing={doorPlacing}
              readOnly={readOnly}
              onCreate={onDoorCreate}
              onPreview={setDoorPreview}
              onSelect={onDoorSelect}
              live={liveDoor}
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
                  />
                ))
              : null}

            <PlanPinLayer
              pins={pins}
              formeGeo={geoById}
              pinDisplay={pinDisplay}
              selectedFormeId={selectedFormeId}
              highlightedEmplacementId={highlightEmplacementId}
              size={pinSize}
              selectedPinId={selectedPinId}
              onSelectPin={onPinSelect}
              readOnly={readOnly}
              live={livePin}
              onTap={onPinTap}
            />
          </View>

          {/* HORS du conteneur zoomé, et rendu APRÈS lui : c'est ce qui rend
              le nom des pièces définitivement visible. Voir RoomLabelLayer. */}
          <RoomLabelLayer
            rooms={roomVisuals}
            pins={pins}
            pinMetrics={PIN_METRICS[pinSize]}
            zoom={zoom}
            textFactor={textFactor}
          />
          </>
          ) : null}
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

// LE NOM DES PIÈCES, HORS DU MONDE ZOOMÉ.
//
// Trois emplacements essayés, et c'est le troisième qui règle la question
// pour de bon — l'histoire mérite d'être écrite, elle explique la forme du
// code.
//
// Au CENTRE de la pièce et peint par le canevas : les puces d'Emplacement
// passaient par-dessus. Ce n'était pas un ordre de dessin à corriger : les
// puces sont des vues natives rendues APRÈS le canevas, donc RIEN de ce que
// Skia peint ne peut passer devant elles.
//
// EN HAUT de la pièce, toujours peint par le canevas : sur un vrai plan, les
// rangements sont contre les murs — celui du haut compris. Les puces
// recouvraient les noms de plus belle (retour utilisateur, capture à l'appui).
//
// Le nom est donc désormais rendu APRÈS les puces ET EN DEHORS du conteneur
// zoomé. Chaque étiquette est posée à la position ÉCRAN de sa pièce, calculée
// à la main : `translation + zoom × coordonnée du monde` — la même formule
// que celle qu'appliquerait le conteneur, faite ici parce qu'on refuse
// justement d'être dedans. Le `transformOrigin: '0 0'` du conteneur est ce
// qui rend cette formule exacte.
//
// Quatre bénéfices, tous acquis d'un coup : plus rien ne peut recouvrir un
// nom ; il garde sa taille sans aucune contre-mise à l'échelle ; c'est React
// Native qui coupe un nom trop long avec ses points de suspension, au lieu
// d'une mesure faite à la main ; et Skia n'a plus besoin de charger de
// police, ce qui retire au passage un mode de panne (matchFont échouait tant
// que CanvasKit n'était pas prêt).
//
// Un halo de la couleur du fond entoure les lettres : c'est ce qui garde le
// nom lisible quand il tombe sur une puce, sans poser un cartouche opaque au
// milieu de chaque pièce.
//
// Rien n'est écrit dans une pièce trop petite pour l'accueillir : mieux vaut
// pas d'étiquette qu'un « … » solitaire.
function RoomLabelLayer({
  rooms,
  pins,
  pinMetrics,
  zoom,
  textFactor,
}: {
  rooms: { id: string; geo: ShapeGeometry; label: string; count: number | null }[];
  pins: PlanPin[];
  pinMetrics: PinMetrics;
  zoom: ZoomState;
  textFactor: number;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const nameSize = Math.round(LABEL_FONT_SIZE * textFactor);
  const countSize = Math.round(COUNT_FONT_SIZE * textFactor);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rooms.map((room) => {
        if (!room.label) return null;
        const width = room.geo.width * zoom.scale;
        const height = room.geo.height * zoom.scale;
        if (width < nameSize * 3 || height < nameSize * 2) return null;

        const showCount = room.count !== null && height >= nameSize * 2 + countSize * 2;
        // Hauteur du bloc à l'écran. Elle sert deux fois : à tester si une
        // puce est déjà là, et à poser le bloc en bas quand il faut.
        const band = LABEL_TOP_CLEARANCE + nameSize * 1.25 + (showCount ? countSize * 1.35 : 0) + 4;

        // EN HAUT SI C'EST LIBRE, SINON EN BAS.
        //
        // Le nom est peint par-dessus tout, donc il ne peut plus disparaître —
        // mais deux textes superposés ne se lisent pas mieux qu'un texte
        // caché. Plutôt que de déplacer les puces, qui sont là où les meubles
        // sont vraiment, c'est l'étiquette qui va se poser là où il reste de
        // la place.
        //
        // Largeur estimée et non mesurée : React Native ne rendra le texte
        // qu'après. L'approximation suffit — se tromper d'un caractère change
        // au pire le choix d'un bandeau pour une étiquette qui frôlait une
        // puce de toute façon.
        const labelWidth = Math.min(width, room.label.length * nameSize * 0.6);
        const left = zoom.translateX + room.geo.x * zoom.scale;
        const top = zoom.translateY + room.geo.y * zoom.scale;
        const boxLeft = left + (width - labelWidth) / 2;
        const boxRight = boxLeft + labelWidth;

        const occupied = (bandTop: number) =>
          pins.some((pin) => {
            if (pin.forme_id !== room.id) return false;
            const centreX = left + pin.rel_x * width;
            const centreY = top + pin.rel_y * height;
            const halfW = (pinMetrics.cardWidth * zoom.scale) / 2;
            const halfH = (pinMetrics.cardHeight * zoom.scale) / 2;
            return (
              centreX + halfW > boxLeft &&
              centreX - halfW < boxRight &&
              centreY + halfH > bandTop &&
              centreY - halfH < bandTop + band
            );
          });

        const bottomBandTop = top + height - band;
        const atBottom = occupied(top) && !occupied(bottomBandTop);

        return (
          <View
            key={room.id}
            style={{
              position: 'absolute',
              left,
              top: atBottom ? bottomBandTop + LABEL_TOP_CLEARANCE : top + LABEL_TOP_CLEARANCE,
              width,
              alignItems: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: nameSize,
                fontWeight: '700',
                color: colors.ink,
                textShadowColor: colors.surface,
                textShadowRadius: 4,
              }}
            >
              {room.label}
            </Text>
            {showCount && room.count !== null ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: countSize,
                  color: colors.inkSoft,
                  textShadowColor: colors.surface,
                  textShadowRadius: 4,
                }}
              >
                {room.count === 0
                  ? t('inventory.objet_count_zero')
                  : t('inventory.objet_count', { count: room.count })}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// Le corps d'une pièce. Un tap la sélectionne, toujours — y compris pendant
// qu'une autre l'est, pour passer de l'une à l'autre sans rien valider.
//
// LE GLISSÉ N'EXISTE QUE SUR LA PIÈCE SÉLECTIONNÉE, et il la déplace (avec
// snapPosition, qui l'accole magnétiquement à ses voisines). Ailleurs le
// geste est éteint, et c'est délibéré : un geste d'enfant éteint laisse
// passer le toucher jusqu'au conteneur, dont le glissé déplace alors la vue.
// C'est ainsi qu'on se déplace en partant de par-dessus une autre pièce, sans
// qu'aucun geste n'ait à en départager un autre.
// LE CORPS D UNE PIÈCE N EST PLUS QU UNE CIBLE DE TAP.
//
// Son glissé est parti dans le geste unique du conteneur (voir plus haut) :
// c est de là que se décide, au toucher, si le doigt déplace la pièce ou le
// plan. Ne reste ici que la sélection, un tap — et un tap ne dispute rien à
// un glissé, il échoue dès que le doigt bouge.
function ShapeBody({ geo, onSelect }: { geo: ShapeGeometry; onSelect: () => void }) {
  // UN SEUL TAP, ET C EST TOUT. La fiche d édition s ouvrait au DOUBLE-tap :
  // un geste que rien n annonçait à l écran, et une vraie difficulté motrice
  // passé un certain âge — or l objectif est que le plan reste utilisable à
  // tout âge. Le tap simple sélectionne, et c est la barre d action en bas
  // d écran (voir plan/[id].tsx) qui donne accès à l édition.
  //
  // Il reste actif en consultation : il ne modifie rien et sert à mettre une
  // pièce en évidence.
  const tap = Gesture.Tap().numberOfTaps(1).hitSlop(12).runOnJS(true).onEnd(() => onSelect());

  return (
    <GestureDetector gesture={tap}>
      <View style={{ position: 'absolute', left: geo.x, top: geo.y, width: geo.width, height: geo.height }} />
    </GestureDetector>
  );
}

// 44px : le minimum recommandé pour une cible tactile. C est aussi le rayon
// dans lequel hitTestPlan reconnaît cette poignée.
export const HANDLE_TOUCH_SIZE = 44;
const HANDLE_DOT_SIZE = 18;

// Le point d ancrage, PUREMENT VISUEL désormais : le redimensionnement est
// porté par le geste unique du conteneur, qui reconnaît la poignée visée par
// sa position. Une vue sans geste ne capte rien et ne coupe donc plus rien.
function HandleDot({ geo, handle }: { geo: ShapeGeometry; handle: HandleId }) {
  const anchor = handleAnchor(geo, handle);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: anchor.x - HANDLE_DOT_SIZE / 2,
        top: anchor.y - HANDLE_DOT_SIZE / 2,
        width: HANDLE_DOT_SIZE,
        height: HANDLE_DOT_SIZE,
        borderRadius: HANDLE_DOT_SIZE / 2,
        backgroundColor: ACCENT,
        borderWidth: 2,
        borderColor: '#fff',
      }}
    />
  );
}
