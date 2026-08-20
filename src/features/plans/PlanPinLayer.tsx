import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon } from '../../components/Icon';
import { IconBadge } from '../../components/IconBadge';
import type { IconName } from '../../components/Icon';
import type { PlanPin } from '../../types/database';
import { clamp, SNAP_THRESHOLD } from './snap';
import type { ShapeGeometry } from './types';

// === Marqueur de localisation ============================================
// Remplace l'ancienne flèche rouge (arrow-down-bold, 16px, #E53935) qui
// flottait au-dessus de la pastille. Deux défauts : elle était minuscule et
// se perdait sur les pastels clairs du plan, et son rouge n'appartenait à
// aucune palette de l'app.
//
// Le marqueur reprend le PIN DU LOGO — le « o » de Céoù, déjà l'icône de
// l'onglet Accueil — dans le bleu d'action de l'app. Sa pointe désigne le
// point exact, un halo au sol l'ancre, et il REMPLACE la pastille au lieu de
// s'ajouter par-dessus : un seul objet à l'écran pour un seul message.
//
// Composé de View + glyphe, jamais de SVG : react-native-svg est absent du
// projet et son usage planterait l'app (voir le commentaire d'IconBadge).
const MARKER_COLOR = '#1591EA';
const MARKER_SIZE = 44;
// Le glyphe map-marker est plein : cette pastille blanche redessine le trou
// central, c'est ce qui fait ressembler le marqueur au logo et non à une
// simple goutte.
const MARKER_HOLE_RATIO = 0.3;
const MARKER_HOLE_TOP_RATIO = 0.235;
// Bordure fine, volontairement plus discrète que le rouge du surlignage
// "Voir sur le plan" — même famille corail que la sélection d'une pièce
// (ShapeBody), juste adoucie en opacité pour rester "légère" comme demandé.
const SELECTED_BORDER = 'rgba(255, 107, 74, 0.6)';

// 30% plus petit que l'ancienne taille (30) pour une meilleure lisibilité du
// plan une fois plusieurs pastilles posées.
const PIN_SIZE = 21;
const PIN_RADIUS = PIN_SIZE / 2;

// Largeur fixe de la zone pastille+nom : permet de centrer le groupe sur
// `screen.x` sans dépendre de la longueur du nom (le nom peut varier, la
// pastille doit rester alignée) — les noms plus longs sont tronqués plutôt
// que d'élargir la zone.
const PIN_LABEL_WIDTH = 80;

type RelPosition = { relX: number; relY: number };

type PlanPinLayerProps = {
  pins: PlanPin[];
  formeGeo: Record<string, ShapeGeometry>;
  pinDisplay: Record<string, { name: string; icon: IconName }>;
  selectedFormeId: string | null;
  highlightedEmplacementId?: string | null;
  scale: number;
  // Consultation seule : les pastilles restent AFFICHÉES (c'est tout leur
  // intérêt — voir où sont les Emplacements) mais ne se déplacent plus et
  // n'ouvrent plus leur fiche, qui ne propose que « Retirer du plan ».
  readOnly?: boolean;
  onDragEnd: (pinId: string, relX: number, relY: number) => void;
  onTap: (pin: PlanPin) => void;
};

// Les pastilles sont toujours affichées (lecture) sur toutes les pièces —
// c'est tout l'intérêt : voir d'un coup d'œil où sont les Emplacements.
// Elles ne deviennent glissables/tapables que sur la pièce actuellement
// sélectionnée, même règle de verrouillage que les formes elles-mêmes.
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
  // Laquelle des pastilles est "sélectionnée" (un tap simple) — pilote à la
  // fois le nom affiché, l'ordre de dessin (au premier plan) et la bordure
  // légère, voir PinBadge. Vit ici plutôt que localement dans chaque
  // PinBadge : l'ordre de dessin (sortedPins ci-dessous) doit connaître
  // QUELLE pastille est sélectionnée pour la dessiner en dernier.
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  // Id de la pastille EN COURS de glisser (pas forcément selectedPinId, qui
  // ne suit que le tap) — protège juste cette pastille-là d'un écrasement
  // par un refetch pendant le geste, voir l'effet ci-dessous.
  const draggingIdRef = useRef<string | null>(null);

  useEffect(() => {
    setPositions((current) => {
      const next = { ...current };
      const ids = new Set(pins.map((p) => p.id));
      for (const pin of pins) {
        // Resynchronise TOUJOURS depuis le serveur, sauf la pastille en
        // plein geste — même correctif que `shapes` dans PlanCanvas : avant
        // ça, une pastille déjà connue de `next` ne recevait plus jamais de
        // valeur fraîche d'un refetch ultérieur (position figée jusqu'au
        // prochain montage complet), symptôme "il faut redémarrer l'app
        // pour voir la modification" alors qu'elle était bien enregistrée.
        if (pin.id === draggingIdRef.current) continue;
        next[pin.id] = { relX: pin.rel_x, relY: pin.rel_y };
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [pins]);

  // La pastille sélectionnée (ou surlignée depuis "Voir sur le plan") se
  // dessine en dernier — sans ça, une pastille mise en avant pouvait rester
  // partiellement recouverte par une voisine posée après elle, exactement
  // le même souci déjà réglé pour les pièces (sortedFormes, PlanCanvas).
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
// approche. Le rayon de la pastille (PIN_RADIUS, en unités monde comme
// SNAP_THRESHOLD — PlanPinLayer vit dans le même contenu mis à l'échelle que
// le reste du plan) est retranché de la plage autorisée : sans ça, rel=0/1
// place le CENTRE de la pastille pile sur le mur, et sa moitié déborde hors
// de la pièce. Le bord de l'icône touche donc le mur, jamais son centre.
function resolveRel(value: number, sideLength: number): number {
  if (sideLength <= 0) return clamp(value, 0, 1);
  const edgeInsetRel = clamp(PIN_RADIUS / sideLength, 0, 0.5);
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
  const dragOrigin = useRef(pos);

  // Plan 2D top-down pur : x/y sont directement des coordonnées écran (dans
  // le repère du contenu zoomable), pas besoin de projeter quoi que ce soit.
  const screen = { x: geo.x + pos.relX * geo.width, y: geo.y + pos.relY * geo.height };

  // Le geste rapporte un delta en pixels ÉCRAN (avant mise à l'échelle du
  // zoom) — diviser par `scale` pour obtenir le déplacement réel dans le
  // repère (non zoomé) où vivent x/y, avant resolveRel (bornage + aimantation
  // sur bord, rayon de la pastille inclus).
  const resolve = (translationX: number, translationY: number): RelPosition => ({
    relX: resolveRel(dragOrigin.current.relX + translationX / scale / geo.width, geo.width),
    relY: resolveRel(dragOrigin.current.relY + translationY / scale / geo.height, geo.height),
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
  // tap simple sélectionne/désélectionne (nom affiché, passe au premier
  // plan, bordure légère — voir PlanPinLayer et le rendu plus bas) ; un
  // double-tap ouvre la fiche "retirer" (onTap).
  const singleTap = Gesture.Tap().numberOfTaps(1).enabled(interactive).hitSlop(6).runOnJS(true).onEnd(onToggleSelect);
  const doubleTap = Gesture.Tap().numberOfTaps(2).enabled(interactive).hitSlop(6).runOnJS(true).onEnd(() => onTap());
  const taps = Gesture.Exclusive(doubleTap, singleTap);
  const gesture = Gesture.Exclusive(pan, taps);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ position: 'absolute', left: screen.x - PIN_LABEL_WIDTH / 2, top: screen.y - PIN_SIZE / 2, width: PIN_LABEL_WIDTH, alignItems: 'center' }}
      >
{highlighted ? (
          <>
            {/* Halo au sol, centré sur le point désigné : ancre le marqueur
                et le rend lisible même posé sur une pièce très colorée. */}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: PIN_RADIUS - 4.5, left: 0, right: 0, alignItems: 'center' }}
            >
              <View style={{ width: 26, height: 9, borderRadius: 13, backgroundColor: 'rgba(21, 145, 234, 0.22)' }} />
            </View>

            {/* Le marqueur, pointe posée sur le point. */}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: PIN_RADIUS - MARKER_SIZE, left: 0, right: 0, alignItems: 'center' }}
            >
              <View style={{ width: MARKER_SIZE, height: MARKER_SIZE, alignItems: 'center' }}>
                <Icon name="location" size={MARKER_SIZE} color={MARKER_COLOR} />
                <View
                  style={{
                    position: 'absolute',
                    top: MARKER_SIZE * MARKER_HOLE_TOP_RATIO,
                    width: MARKER_SIZE * MARKER_HOLE_RATIO,
                    height: MARKER_SIZE * MARKER_HOLE_RATIO,
                    borderRadius: (MARKER_SIZE * MARKER_HOLE_RATIO) / 2,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </View>
            </View>

            {/* Réserve la hauteur qu'occupait la pastille, pour que le nom
                affiché en dessous ne remonte pas quand le marqueur la
                remplace. */}
            <View style={{ height: PIN_SIZE }} />
          </>
        ) : (
          <IconBadge
            icon={display.icon}
            fill="#FFFBF8"
            size={PIN_SIZE}
            borderColor={selected ? SELECTED_BORDER : undefined}
            borderWidth={1.5}
          />
        )}
        {selected || highlighted ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 2,
              maxWidth: PIN_LABEL_WIDTH,
              borderRadius: 4,
              paddingHorizontal: 3,
              paddingVertical: 1,
              backgroundColor: 'rgba(255, 251, 248, 0.85)',
              fontSize: 9,
              lineHeight: 11,
              textAlign: 'center',
              color: '#2D2A26',
            }}
          >
            {display.name}
          </Text>
        ) : null}
      </View>
    </GestureDetector>
  );
}
