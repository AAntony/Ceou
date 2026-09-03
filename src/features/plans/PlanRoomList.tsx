import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { DEFAULT_PIECE_COLOR, getPieceIcon } from '../inventory/constants';
import { tintForDark } from '../../lib/color';
import { useTheme, useThemeColors } from '../../lib/theme';
import { roomColorForForme } from './constants';
import { planOutline, type OutlineRoom, type OutlineZone } from './planOutline';
import type { DoorEdge } from './types';
import type { Piece, PlanDoor, PlanForme, PlanPin } from '../../types/database';

// LE MÊME NIVEAU, EN PHRASES.
//
// Le plan est peint sur un canevas Skia : pas un mot, pas une cible tactile.
// Un lecteur d'écran le survole en silence, et tout s'y joue au pincement et
// au glissé à deux doigts. Pour qui ne voit pas l'écran — ou ne peut pas
// faire ces gestes-là — la fonctionnalité n'existait pas du tout.
//
// Cette liste dit CE QUE LE DESSIN MONTRE, et rien d'autre : les pièces de ce
// niveau, où elles sont sur la feuille, ce qui les sépare et ce qui les
// relie. Elle se lit dans l'ordre où l'œil parcourt un plan (voir
// planOutline), pas dans l'ordre de création.
//
// ELLE NE MODIFIE RIEN, ET C'EST ASSUMÉ. Dessiner se fait au doigt sur le
// canevas ; en faire l'équivalent en liste serait un autre chantier, bien
// plus gros, et pas celui qui manquait. Ce qui manquait, c'était de pouvoir
// LIRE son plan.
//
// Une carte plutôt qu'une EntityRow, malgré la règle « une seule forme de
// liste » : une rangée d'entité porte un sous-titre d'UNE ligne, et les trois
// phrases de circulation — celles qui font tout l'intérêt d'un plan — n'y
// tiendraient pas sans être tronquées. Le reste du vocabulaire visuel (rayon,
// bordure, pastille, chevron) est bien celui des rangées.

const ZONE_KEY: Record<OutlineZone, string> = {
  nw: 'plans.list.zone.nw',
  n: 'plans.list.zone.n',
  ne: 'plans.list.zone.ne',
  w: 'plans.list.zone.w',
  c: 'plans.list.zone.c',
  e: 'plans.list.zone.e',
  sw: 'plans.list.zone.sw',
  s: 'plans.list.zone.s',
  se: 'plans.list.zone.se',
};

type PlanRoomListProps = {
  formes: PlanForme[];
  doors: PlanDoor[];
  pins: PlanPin[];
  pieces: Piece[];
  /** Nom des Emplacements posés sur le plan, tel que le canevas les écrit. */
  pinNames: Record<string, string>;
  /** Objets par pièce — le même compteur que celui dessiné sur le plan. */
  roomCounts?: Record<string, number>;
  /** Rangements par pièce, tous, placés sur le plan ou non. */
  storageCounts: Record<string, number>;
  /** Vient de « Voir sur le plan » : la pièce à retrouver. */
  highlightFormeId?: string;
  onOpenRoom: (pieceId: string) => void;
};

export function PlanRoomList({
  formes,
  doors,
  pins,
  pieces,
  pinNames,
  roomCounts,
  storageCounts,
  highlightFormeId,
  onOpenRoom,
}: PlanRoomListProps) {
  const { t } = useTranslation();

  const rooms = useMemo(
    () =>
      planOutline(
        formes.map((forme) => ({
          id: forme.id,
          pieceId: forme.piece_id,
          x: forme.x,
          y: forme.y,
          width: forme.width,
          height: forme.height,
        })),
        doors.map((door) => ({ formeId: door.forme_id, edge: door.edge as DoorEdge, position: door.position })),
      ),
    [formes, doors],
  );

  const pieceById = useMemo(() => Object.fromEntries(pieces.map((piece) => [piece.id, piece])), [pieces]);

  // Le nom d'une forme, tel qu'il apparaît sur le dessin : celui de sa pièce,
  // ou l'étiquette des formes qu'on a tracées sans encore leur en associer
  // une. Une forme sans pièce reste dans la liste — elle est bien sur le
  // plan, et l'omettre ferait mentir le compte des pièces dessinées.
  const nameOf = (formeId: string): string => {
    const room = rooms.find((entry) => entry.id === formeId);
    const piece = room?.pieceId ? pieceById[room.pieceId] : undefined;
    return piece?.name ?? t('plans.unassigned_room');
  };

  return (
    <ScrollView
      className="flex-1"
      // Assez de place sous la dernière carte pour que le sélecteur de niveau
      // et le bouton de bascule, qui FLOTTENT par-dessus, ne la recouvrent pas.
      contentContainerClassName="pb-40"
    >
      <Text className="mb-3 text-label text-ink-soft">{t('plans.rooms_count', { count: formes.length })}</Text>

      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          piece={room.pieceId ? (pieceById[room.pieceId] ?? null) : null}
          name={nameOf(room.id)}
          neighbourName={nameOf}
          objectCount={room.pieceId ? (roomCounts?.[room.pieceId] ?? null) : null}
          storageCount={room.pieceId ? (storageCounts[room.pieceId] ?? 0) : 0}
          placed={pins.filter((pin) => pin.forme_id === room.id).map((pin) => pinNames[pin.emplacement_id] ?? '')}
          highlighted={room.id === highlightFormeId}
          onOpen={room.pieceId ? () => onOpenRoom(room.pieceId as string) : null}
        />
      ))}
    </ScrollView>
  );
}

function RoomCard({
  room,
  piece,
  name,
  neighbourName,
  objectCount,
  storageCount,
  placed,
  highlighted,
  onOpen,
}: {
  room: OutlineRoom;
  piece: Piece | null;
  name: string;
  neighbourName: (formeId: string) => string;
  objectCount: number | null;
  storageCount: number;
  placed: string[];
  highlighted: boolean;
  onOpen: (() => void) | null;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isDark } = useTheme();

  // La MÊME couleur que sur le dessin, adaptée au thème de la même façon
  // (voir PlanCanvas) : c'est elle qui permet de retrouver dans la liste la
  // pièce qu'on vient de voir sur le plan, et l'inverse.
  const pastel = piece ? (piece.color ?? DEFAULT_PIECE_COLOR) : roomColorForForme(room.id);
  const fill = isDark ? tintForDark(pastel) : pastel;

  const meta = [
    room.zone ? t(ZONE_KEY[room.zone]) : null,
    objectCount === null ? null : t('plans.room_sheet.objects', { count: objectCount }),
    piece ? t('plans.room_sheet.storages', { count: storageCount }) : null,
  ].filter(Boolean);

  const facts = [
    room.connected.length > 0
      ? t('plans.list.connected', { rooms: room.connected.map(neighbourName).join(', ') })
      : null,
    room.adjacent.length > 0 ? t('plans.list.adjacent', { rooms: room.adjacent.map(neighbourName).join(', ') }) : null,
    room.outside > 0 ? t('plans.list.outside', { count: room.outside }) : null,
    placed.length > 0 ? t('plans.list.placed', { names: placed.filter(Boolean).join(', ') }) : null,
  ].filter((fact): fact is string => Boolean(fact));

  const body = (
    <>
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: fill }}>
          <Icon name={piece ? getPieceIcon(piece.preset_key) : 'rectangle'} size={22} color={colors.ink} />
        </View>
        <View className="flex-1">
          <Text className="text-body font-semibold text-ink">{name}</Text>
          {meta.length > 0 ? <Text className="mt-0.5 text-caption text-ink-soft">{meta.join(' · ')}</Text> : null}
        </View>
        {onOpen ? <Icon name="chevron" size={18} color={colors.inkFaint} /> : null}
      </View>

      {facts.length > 0 ? (
        <View className="mt-2 gap-1">
          {facts.map((fact) => (
            // Interligne en `rem` comme le rappel des gestes : figé, il rogne
            // les jambages dès que le texte grossit.
            <Text key={fact} className="text-caption leading-[1.21rem] text-ink-soft">
              {fact}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );

  // Une seule phrase pour le lecteur d'écran, sinon il annonce six fragments
  // sans lien : le nom, puis « en haut à gauche », puis « 12 objets »…
  const spoken = [name, ...meta, ...facts].join(', ');

  const shell = `mb-2.5 rounded-2xl border bg-surface px-4 py-3 ${
    highlighted ? 'border-coral border-2' : 'border-ink/10'
  }`;

  if (!onOpen) {
    return (
      <View className={shell} accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }

  return (
    <Pressable className={`${shell} active:opacity-70`} onPress={onOpen} accessibilityRole="button" accessibilityLabel={spoken}>
      {body}
    </Pressable>
  );
}
