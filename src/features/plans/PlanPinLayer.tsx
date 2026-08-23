import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import type { PlanPin } from '../../types/database';
import { useThemeColors } from '../../lib/theme';
import { clamp, SNAP_THRESHOLD } from './snap';
import type { ShapeGeometry } from './types';

// === La puce d'un Emplacement ============================================
//
// Une petite carte : l'icône de l'Emplacement, son nom en dessous, un cadre
// autour. Elle remplace le rond de 21 px dont le nom n'apparaissait qu'au
// toucher — or la question posée au plan est « qu'est-ce qu'il y a là ? », et
// un rond sans nom n'y répond pas. Le nom est donc toujours lisible.
//
// Cadre IDENTIQUE pour toutes (décision produit) : la puce se pose sur une
// pièce déjà teintée, une couleur de plus ne ferait que brouiller la lecture
// des pièces. Le bleu d'action de l'app suffit à dire « ceci est un objet du
// plan, pas un mur ».
//
// Composée de View + glyphe, jamais de SVG : react-native-svg est absent du
// projet et son usage planterait l'app (voir le commentaire d'IconBadge).
const ACCENT = '#1591EA';

// Dimensions FIXES, en unités de la feuille (la couche vit dans le même
// contenu mis à l'échelle que le plan, donc la puce zoome avec lui). Fixes et
// non déduites du contenu : la puce doit être centrée exactement sur le point
// qu'elle désigne, ce qui suppose de connaître sa moitié avant le rendu.
// Calibrées sur les pièces réelles (les gabarits vont de 50×130 à 200×260) :
// au-delà, deux puces dans une chambre se recouvriraient.
const CARD_WIDTH = 54;
const CARD_HEIGHT = 36;
const ICON_SIZE = 16;
const LABEL_SIZE = 8.5;

// Le nom est TRONQUÉ, jamais rétréci ni mis sur deux lignes : la puce garde
// la même empreinte quel que soit l'Emplacement, sans quoi une rangée de
// puces deviendrait un escalier. Un point final marque la coupe — plus
// discret que « … » à cette taille de texte, où les trois points se collent
// et se lisent mal.
//
// Coupe au NOMBRE DE CARACTÈRES et non à la largeur mesurée : React Native
// ne sait pas mesurer un texte de façon synchrone au rendu, et le faire en
// asynchrone ferait clignoter chaque puce à l'ouverture du plan. Le plafond
// est calé sur le pire cas (des majuscules) pour que le point final tienne
// toujours dans la carte.
const MAX_LABEL_CHARS = 8;

function shortLabel(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= MAX_LABEL_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_LABEL_CHARS).trimEnd()}.`;
}

type RelPosition = { relX: number; relY: number };

// Où poser une puce qu'on vient d'ajouter. Toutes arrivaient au centre exact
// de la pièce (0.5 / 0.5) : elles s'empilaient donc les unes sur les autres,
// ET sur le nom de la pièce écrit à cet endroit précis. Deux ajouts de suite
// donnaient une seule puce visible. Les emplacements ci-dessous s'écartent du
// centre et se répartissent, quitte à être ensuite glissés là où ils sont
// vraiment.
const PIN_SLOTS: RelPosition[] = [
  { relX: 0.5, relY: 0.7 },
  { relX: 0.25, relY: 0.7 },
  { relX: 0.75, relY: 0.7 },
  { relX: 0.25, relY: 0.28 },
  { relX: 0.75, relY: 0.28 },
  { relX: 0.5, relY: 0.28 },
  { relX: 0.25, relY: 0.92 },
  { relX: 0.5, relY: 0.92 },
  { relX: 0.75, relY: 0.92 },
];

export function nextPinSlot(alreadyPlaced: number): RelPosition {
  return PIN_SLOTS[alreadyPlaced % PIN_SLOTS.length];
}

type PlanPinLayerProps = {
  pins: PlanPin[];
  formeGeo: Record<string, ShapeGeometry>;
  pinDisplay: Record<string, { name: string; icon: IconName }>;
  selectedFormeId: string | null;
  highlightedEmplacementId?: string | null;
  scale: number;
  // Consultation seule : les puces restent AFFICHÉES (c'est tout leur
  // intérêt — voir où sont les Emplacements) mais ne se déplacent plus et
  // n'ouvrent plus leur fiche, qui ne propose que « Retirer du plan ».
  readOnly?: boolean;
  onDragEnd: (pinId: string, relX: number, relY: number) => void;
  onTap: (pin: PlanPin) => void;
};

// Les puces sont toujours affichées (lecture) sur toutes les pièces — c'est
// tout l'intérêt : voir d'un coup d'œil où sont les Emplacements. Elles ne
// deviennent glissables/tapables que sur la pièce actuellement sélectionnée,
// même règle de verrouillage que les formes elles-mêmes.
//
// Même pattern que `shapes` dans PlanCanvas : la position vécue pendant un
// glisser vit dans un state ici (mise à jour à chaque frame par le geste),
// synchronisée depuis les props à l'arrivée/au changement d'un pin — un
// seul aller-retour réseau à la fin du geste, pas à chaque frame.
export function PlanPinLayer({
  pins,
  formeGeo,
  pinDisplay,
  selectedFormeId,
  highlightedEmplacementId,
  scale,
  readOnly = false,
  onDragEnd,
  onTap,
}: PlanPinLayerProps) {
  const [positions, setPositions] = useState<Record<string, RelPosition>>({});
  // Laquelle des puces est "sélectionnée" (un tap simple) — pilote l'ordre de
  // dessin (au premier plan) et l'appui du cadre. Vit ici plutôt que
  // localement dans chaque PinBadge : l'ordre de dessin (sortedPins ci-
  // dessous) doit connaître QUELLE puce est sélectionnée pour la dessiner en
  // dernier.
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  // Id de la puce EN COURS de glisser (pas forcément selectedPinId, qui ne
  // suit que le tap) — protège juste celle-là d'un écrasement par un refetch
  // pendant le geste, voir l'effet ci-dessous.
  const draggingIdRef = useRef<string | null>(null);

  useEffect(() => {
    setPositions((current) => {
      const next = { ...current };
      const ids = new Set(pins.map((p) => p.id));
      for (const pin of pins) {
        // Resynchronise TOUJOURS depuis le serveur, sauf la puce en plein
        // geste — même correctif que `shapes` dans PlanCanvas : avant ça, une
        // puce déjà connue de `next` ne recevait plus jamais de valeur fraîche
        // d'un refetch ultérieur (position figée jusqu'au prochain montage
        // complet), symptôme "il faut redémarrer l'app pour voir la
        // modification" alors qu'elle était bien enregistrée.
        if (pin.id === draggingIdRef.current) continue;
        next[pin.id] = { relX: pin.rel_x, relY: pin.rel_y };
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [pins]);

  // La puce sélectionnée (ou mise en évidence depuis "Voir sur le plan") se
  // dessine en dernier — sans ça, une puce mise en avant pouvait rester
  // partiellement recouverte par une voisine posée après elle, exactement le
  // même souci déjà réglé pour les pièces (sortedFormes, PlanCanvas).
  const sortedPins = useMemo(
    () =>
      [...pins].sort((a, b) => {
        const aFront = a.id === selectedPinId || a.emplacement_id === highlightedEmplacementId ? 1 : 0;
        const bFront = b.id === selectedPinId || b.emplacement_id === highlightedEmplacementId ? 1 : 0;
        return aFront - bFront;
      }),
    [pins, selectedPinId, highlightedEmplacementId],
  );

  return (
    <>
      {sortedPins.map((pin) => {
        const geo = formeGeo[pin.forme_id];
        const display = pinDisplay[pin.emplacement_id];
        const pos = positions[pin.id] ?? { relX: pin.rel_x, relY: pin.rel_y };
        if (!geo || !display) return null;
        return (
          <PinBadge
            key={pin.id}
            geo={geo}
            pos={pos}
            display={display}
            interactive={!readOnly && pin.forme_id === selectedFormeId}
            selected={pin.id === selectedPinId}
            highlighted={pin.emplacement_id === highlightedEmplacementId}
            scale={scale}
            onDragStart={() => {
              draggingIdRef.current = pin.id;
            }}
            onMove={(next) => setPositions((current) => ({ ...current, [pin.id]: next }))}
            onDragEnd={(next) => {
              draggingIdRef.current = null;
              onDragEnd(pin.id, next.relX, next.relY);
            }}
            onToggleSelect={() => setSelectedPinId((current) => (current === pin.id ? null : pin.id))}
            onTap={() => onTap(pin)}
          />
        );
      })}
    </>
  );
}

// Borne ET aimante rel_x/rel_y sur un bord de la pièce quand on l'en
// approche. La DEMI-TAILLE de la puce (en unités monde, comme
// SNAP_THRESHOLD — cette couche vit dans le même contenu mis à l'échelle que
// le reste du plan) est retranchée de la plage autorisée : sans ça, rel=0/1
// place le CENTRE de la puce pile sur le mur et sa moitié déborde hors de la
// pièce. C'est donc le bord de la carte qui touche le mur, jamais son centre.
// Sur une pièce plus étroite que la puce, la plage se referme au centre.
function resolveRel(value: number, sideLength: number, halfSize: number): number {
  if (sideLength <= 0) return clamp(value, 0, 1);
  const edgeInsetRel = clamp(halfSize / sideLength, 0, 0.5);
  const thresholdRel = SNAP_THRESHOLD / sideLength;
  const bounded = clamp(value, edgeInsetRel, 1 - edgeInsetRel);
  if (bounded < edgeInsetRel + thresholdRel) return edgeInsetRel;
  if (bounded > 1 - edgeInsetRel - thresholdRel) return 1 - edgeInsetRel;
  return bounded;
}

function PinBadge({
  geo,
  pos,
  display,
  interactive,
  selected,
  highlighted,
  scale,
  onDragStart,
  onMove,
  onDragEnd,
  onToggleSelect,
  onTap,
}: {
  geo: ShapeGeometry;
  pos: RelPosition;
  display: { name: string; icon: IconName };
  interactive: boolean;
  selected: boolean;
  highlighted: boolean;
  scale: number;
  onDragStart: () => void;
  onMove: (pos: RelPosition) => void;
  onDragEnd: (pos: RelPosition) => void;
  onToggleSelect: () => void;
  onTap: () => void;
}) {
  const colors = useThemeColors();
  const dragOrigin = useRef(pos);

  // Plan 2D top-down pur : x/y sont directement des coordonnées écran (dans
  // le repère du contenu zoomable), pas besoin de projeter quoi que ce soit.
  const screen = { x: geo.x + pos.relX * geo.width, y: geo.y + pos.relY * geo.height };

  // Le geste rapporte un delta en pixels ÉCRAN (avant mise à l'échelle du
  // zoom) — diviser par `scale` pour obtenir le déplacement réel dans le
  // repère (non zoomé) où vivent x/y, avant resolveRel (bornage + aimantation
  // sur bord, demi-taille de la puce incluse).
  const resolve = (translationX: number, translationY: number): RelPosition => ({
    relX: resolveRel(dragOrigin.current.relX + translationX / scale / geo.width, geo.width, CARD_WIDTH / 2),
    relY: resolveRel(dragOrigin.current.relY + translationY / scale / geo.height, geo.height, CARD_HEIGHT / 2),
  });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(interactive)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = pos;
      onDragStart();
    })
    .onUpdate((event) => onMove(resolve(event.translationX, event.translationY)))
    .onEnd((event) => onDragEnd(resolve(event.translationX, event.translationY)));

  // Même principe que ShapeBody (pièces) : doubleTap listé en premier dans
  // Exclusive pour que singleTap attende de voir si un second tap suit. Un
  // tap simple sélectionne/désélectionne (passe au premier plan, cadre
  // appuyé) ; un double-tap ouvre la fiche "retirer" (onTap).
  const singleTap = Gesture.Tap().numberOfTaps(1).enabled(interactive).hitSlop(6).runOnJS(true).onEnd(onToggleSelect);
  const doubleTap = Gesture.Tap().numberOfTaps(2).enabled(interactive).hitSlop(6).runOnJS(true).onEnd(() => onTap());
  const taps = Gesture.Exclusive(doubleTap, singleTap);
  const gesture = Gesture.Exclusive(pan, taps);

  // Mise en évidence ("Voir sur le plan", depuis la fiche d'un objet) : c'est
  // la puce ELLE-MÊME qui passe en bleu plein, entourée d'un halo. Elle
  // remplaçait auparavant sa place par un gros marqueur à pointe — deux
  // objets de styles différents pour un seul message, et le nom se retrouvait
  // ailleurs que sur le point désigné.
  const inkColor = highlighted ? '#FFFFFF' : colors.ink;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          position: 'absolute',
          left: screen.x - CARD_WIDTH / 2,
          top: screen.y - CARD_HEIGHT / 2,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {highlighted ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -4,
              right: -4,
              top: -4,
              bottom: -4,
              borderRadius: 13,
              backgroundColor: 'rgba(21, 145, 234, 0.22)',
            }}
          />
        ) : null}

        <View
          style={{
            maxWidth: CARD_WIDTH,
            height: CARD_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
            borderRadius: 9,
            borderWidth: selected ? 2.5 : 1.5,
            borderColor: ACCENT,
            backgroundColor: highlighted ? ACCENT : colors.surface,
          }}
        >
          <Icon name={display.icon} size={ICON_SIZE} color={highlighted ? '#FFFFFF' : ACCENT} />
          <Text
            numberOfLines={1}
            style={{
              marginTop: 1,
              fontSize: LABEL_SIZE,
              lineHeight: 10,
              fontWeight: '600',
              textAlign: 'center',
              color: inkColor,
            }}
          >
            {shortLabel(display.name)}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}
