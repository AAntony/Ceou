import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import type { PlanPin } from '../../types/database';
import { useThemeColors } from '../../lib/theme';
import { PIN_METRICS, type PinMetrics, type PinSize } from './pinSize';
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

// Les dimensions de la carte viennent de PIN_METRICS (taille S/M/XL choisie
// par la personne). Elles sont FIXES pour une taille donnée, en unités de la
// feuille — la couche vit dans le même contenu mis à l'échelle que le plan,
// donc la puce zoome avec lui. Fixes et non déduites du contenu : la puce doit
// être centrée exactement sur le point qu'elle désigne, ce qui suppose de
// connaître sa moitié avant le rendu.

// En taille S, le nom est TRONQUÉ : la carte fait 54 unités de large, aucun
// nom d'Emplacement n'y tient. Un point final marque la coupe — plus discret
// que « … » à cette taille de texte, où les trois points se collent et se
// lisent mal.
//
// Coupe au NOMBRE DE CARACTÈRES et non à la largeur mesurée : React Native ne
// sait pas mesurer un texte de façon synchrone au rendu, et le faire en
// asynchrone ferait clignoter chaque puce à l'ouverture du plan. Le plafond
// est calé sur le pire cas (des majuscules) pour que le point final tienne
// toujours dans la carte.
//
// En M et XL, il n'y a plus de plafond : la carte est assez grande pour le
// nom entier, sur deux ou trois lignes au besoin.
function pinLabel(name: string, maxChars: number | null): string {
  const trimmed = name.trim();
  if (maxChars === null || trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}.`;
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
  size: PinSize;
  // La sélection d'une puce vit chez l'écran et non ici : c'est elle qui fait
  // apparaître le sélecteur S/M/XL au-dessus du plan.
  selectedPinId: string | null;
  onSelectPin: (pinId: string | null) => void;
  // Consultation seule : les puces restent AFFICHÉES (c'est tout leur
  // intérêt — voir où sont les Emplacements) mais ne se déplacent plus et
  // n'ouvrent plus leur fiche, qui ne propose que « Retirer du plan ».
  readOnly?: boolean;
  /** La puce en cours de glissé, donnée en direct par le conteneur. */
  live: { id: string; relX: number; relY: number } | null;
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
  size,
  selectedPinId,
  onSelectPin,
  readOnly = false,
  live,
  onTap,
}: PlanPinLayerProps) {
  const metrics = PIN_METRICS[size];

  // La puce sélectionnée (ou mise en évidence depuis « Voir sur le plan ») se
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
        if (!geo || !display) return null;
        // La valeur du serveur, sauf pour la puce qu on est en train de
        // glisser : celle-là, le conteneur la donne en direct.
        const pos = live?.id === pin.id ? { relX: live.relX, relY: live.relY } : { relX: pin.rel_x, relY: pin.rel_y };
        return (
          <PinBadge
            key={pin.id}
            geo={geo}
            pos={pos}
            display={display}
            interactive={!readOnly && pin.forme_id === selectedFormeId}
            selected={pin.id === selectedPinId}
            highlighted={pin.emplacement_id === highlightedEmplacementId}
            metrics={metrics}
            onToggleSelect={() => onSelectPin(selectedPinId === pin.id ? null : pin.id)}
            onTap={() => onTap(pin)}
          />
        );
      })}
    </>
  );
}

function PinBadge({
  geo,
  pos,
  display,
  interactive,
  selected,
  highlighted,
  metrics,
  onToggleSelect,
  onTap,
}: {
  geo: ShapeGeometry;
  pos: RelPosition;
  display: { name: string; icon: IconName };
  interactive: boolean;
  selected: boolean;
  highlighted: boolean;
  metrics: PinMetrics;
  onToggleSelect: () => void;
  onTap: () => void;
}) {
  const colors = useThemeColors();
  // Plan 2D top-down pur : x/y sont directement des coordonnées de feuille.
  const screen = { x: geo.x + pos.relX * geo.width, y: geo.y + pos.relY * geo.height };

  // LE GLISSÉ D UNE PUCE EST PARTI DANS LE GESTE UNIQUE DU CONTENEUR. Ne
  // restent ici que les deux taps — et un tap ne dispute rien à un glissé,
  // il échoue dès que le doigt bouge.
  //
  // Même principe que le corps d une pièce : un tap simple désigne la puce,
  // un double-tap ouvre sa fiche « retirer du plan ».
  const singleTap = Gesture.Tap().numberOfTaps(1).enabled(interactive).hitSlop(6).runOnJS(true).onEnd(onToggleSelect);
  const doubleTap = Gesture.Tap().numberOfTaps(2).enabled(interactive).hitSlop(6).runOnJS(true).onEnd(() => onTap());
  const gesture = Gesture.Exclusive(doubleTap, singleTap);

  // Mise en évidence ("Voir sur le plan", depuis la fiche d'un objet) : c'est
  // la puce ELLE-MÊME qui passe en bleu plein, entourée d'un halo, et coiffée
  // du marqueur de localisation. Un gros marqueur à pointe la remplaçait
  // auparavant — deux objets de styles différents pour un seul message, et le
  // nom se retrouvait ailleurs que sur le point désigné.
  const inkColor = highlighted ? '#FFFFFF' : colors.ink;
  const halo = Math.max(4, metrics.border * 2.5);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          position: 'absolute',
          left: screen.x - metrics.cardWidth / 2,
          top: screen.y - metrics.cardHeight / 2,
          width: metrics.cardWidth,
          height: metrics.cardHeight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {highlighted ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -halo,
              right: -halo,
              top: -halo,
              bottom: -halo,
              borderRadius: metrics.radius + halo,
              backgroundColor: 'rgba(21, 145, 234, 0.22)',
            }}
          />
        ) : null}

        <View
          style={{
            maxWidth: metrics.cardWidth,
            height: metrics.cardHeight,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: metrics.padding,
            borderRadius: metrics.radius,
            borderWidth: selected ? metrics.border * 1.7 : metrics.border,
            borderColor: ACCENT,
            backgroundColor: highlighted ? ACCENT : colors.surface,
          }}
        >
          {/* `fixedSize` : la puce est dessinee en unites de la feuille et
              zoome deja avec le plan. Le reglage de taille de l'app la ferait
              deborder de sa carte — le Plan a son propre selecteur S/M/XL. */}
          <Icon name={display.icon} size={metrics.icon} color={highlighted ? '#FFFFFF' : ACCENT} fixedSize />
          <Text
            numberOfLines={metrics.lines}
            style={{
              marginTop: metrics.lineHeight * 0.1,
              fontSize: metrics.label,
              lineHeight: metrics.lineHeight,
              fontWeight: '600',
              textAlign: 'center',
              color: inkColor,
            }}
          >
            {pinLabel(display.name, metrics.maxChars)}
          </Text>
        </View>

        {/* Le marqueur de localisation, posé à cheval sur le haut de la puce.
            C'est le pin du logo — le « o » de Céoù, déjà l'icône de l'onglet
            Accueil : la réponse à « où est mon objet ? » porte donc la marque
            de l'app. Il ne sort QUE pour la mise en évidence, sinon toutes les
            puces le porteraient et il ne désignerait plus rien. */}
        {highlighted ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -metrics.marker * 0.55,
              width: metrics.marker,
              height: metrics.marker,
              borderRadius: metrics.marker / 2,
              backgroundColor: '#FFFFFF',
              borderWidth: metrics.border,
              borderColor: ACCENT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="location" size={metrics.marker * 0.62} color={ACCENT} fixedSize />
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}
