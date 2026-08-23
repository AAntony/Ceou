import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityRow } from '../../components/EntityRow';
import { ErrorState } from '../../components/ErrorState';
import { Icon } from '../../components/Icon';
import { PresetPicker } from '../../components/PresetPicker';
import { supabase } from '../../lib/supabase/client';
import type { Conteneur, Emplacement, Habitation, LocationType, Piece } from '../../types/database';
import {
  DEFAULT_PIECE_COLOR,
  EMPLACEMENT_PRESETS,
  HABITATION_TYPES,
  PIECE_TYPES,
  getConteneurIcon,
  getEmplacementIcon,
  getHabitationIcon,
  getPieceIcon,
  isSingleSpaceHabitation,
  type EmplacementPresetKey,
  type HabitationTypeKey,
  type PieceTypeKey,
} from './constants';
import { objetCountLabel } from './counts';
import {
  nodeCountKey,
  useContainerContents,
  useCreateConteneur,
  useCreateEmplacement,
  useCreateHabitation,
  useCreatePiece,
  useEmplacements,
  useHabitationIdForNode,
  useHabitationNodeCounts,
  useHabitationObjectCounts,
  useHabitations,
  usePieces,
} from './queries';
import { useEntityTints, useThemeColors } from '../../lib/theme';

type Step =
  | { level: 'habitations' }
  | { level: 'pieces'; habitationId: string }
  | { level: 'emplacements'; pieceId: string }
  | { level: 'container'; type: LocationType; id: string; name: string };

type LocationTreePickerProps = {
  // Remonte la pile à la racine à chaque fois que cette valeur passe à true
  // (typiquement `visible` de la modale parente) — le picker peut rester
  // monté d'un usage à l'autre.
  active: boolean;
  confirmLabel: string;
  loading?: boolean;
  onChoose: (type: LocationType, id: string) => void;
};

// Navigation en cascade Habitations -> Pièces -> Emplacements -> Conteneurs,
// réutilisée à la fois pour déplacer un objet (MoveObjetModal) et pour
// choisir la destination d'un nouvel objet (AddObjetModal) — même
// arborescence, seule l'action finale change.
//
// Les rangées sont RIGOUREUSEMENT celles des écrans de navigation (EntityRow
// : vignette, icône, nom, nombre d'objets). Ce n'est pas de la cosmétique :
// on demande ici à quelqu'un de reconnaître un endroit de chez lui, et il
// vient de le voir sous une autre forme deux écrans plus tôt. Le nombre
// d'objets, en particulier, est souvent ce qui permet de distinguer deux
// placards portant le même nom.
//
// Ce que ces rangées n'ont PAS, volontairement : ni crayon, ni suppression
// par appui long, ni étoile de favori. On choisit une destination, on
// n'administre pas son inventaire.
//
// Règle d'ergonomie : à AUCUN niveau l'utilisateur ne doit se retrouver
// devant une liste vide sans issue. Chaque étape propose donc une création
// à la volée (habitation/pièce/emplacement/conteneur) qui enchaîne
// automatiquement sur l'étape suivante — la création d'un Emplacement ou
// d'un Conteneur (niveaux terminaux, ceux qu'un objet peut effectivement
// habiter) va même jusqu'à appeler `onChoose` directement : un
// emplacement/conteneur tout juste créé est forcément vide, l'étape de
// confirmation intermédiaire n'apporterait rien.
export function LocationTreePicker({ active, confirmLabel, loading, onChoose }: LocationTreePickerProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [stack, setStack] = useState<Step[]>([{ level: 'habitations' }]);

  useEffect(() => {
    if (active) setStack([{ level: 'habitations' }]);
  }, [active]);

  const current = stack[stack.length - 1];
  const push = (step: Step) => setStack((s) => [...s, step]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const handleSelectHabitation = async (habitation: Habitation) => {
    if (isSingleSpaceHabitation(habitation.type)) {
      const { data } = await supabase.from('pieces').select('id').eq('habitation_id', habitation.id).single();
      if (data) push({ level: 'emplacements', pieceId: data.id });
    } else {
      push({ level: 'pieces', habitationId: habitation.id });
    }
  };

  return (
    <View>
      {stack.length > 1 ? (
        <Pressable onPress={pop} hitSlop={8} className="mb-3 flex-row items-center gap-1 self-start">
          <Icon name="back" size={16} color={colors.inkSoft} />
          <Text className="text-sm font-medium text-ink-soft">{t('common.back')}</Text>
        </Pressable>
      ) : null}

      {current.level === 'habitations' && <HabitationsStep onSelect={handleSelectHabitation} />}
      {current.level === 'pieces' && (
        <PiecesStep habitationId={current.habitationId} onSelect={(piece) => push({ level: 'emplacements', pieceId: piece.id })} />
      )}
      {current.level === 'emplacements' && (
        <EmplacementsStep
          pieceId={current.pieceId}
          onSelect={(emplacement) => push({ level: 'container', type: 'emplacement', id: emplacement.id, name: emplacement.name })}
          onCreated={(emplacement) => onChoose('emplacement', emplacement.id)}
        />
      )}
      {current.level === 'container' && (
        <ContainerStep
          type={current.type}
          id={current.id}
          confirmLabel={confirmLabel}
          loading={loading}
          onSelectConteneur={(conteneur) => push({ level: 'container', type: 'conteneur', id: conteneur.id, name: conteneur.name })}
          onChooseHere={() => onChoose(current.type, current.id)}
          onCreatedConteneur={(conteneur) => onChoose('conteneur', conteneur.id)}
        />
      )}
    </View>
  );
}

// Carte d'action "créer à la volée" — délibérément distincte des cartes de
// sélection (bordure en pointillés + teinte corail) pour qu'elle se
// reconnaisse immédiatement comme une action différente de "choisir un
// élément existant", même noyée au milieu d'une longue liste.
function AddInlineCard({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      className="mb-2 flex-row items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-coral bg-coral-light px-4 py-3 active:opacity-70"
    >
      <Icon name="add" size={18} color={colors.accentDark} />
      <Text className="text-base font-semibold text-coral-dark">{label}</Text>
    </Pressable>
  );
}

function HabitationsStep({ onSelect }: { onSelect: (habitation: Habitation) => void }) {
  const { t } = useTranslation();
  const { data: habitations, isLoading, isError, refetch } = useHabitations();
  const { data: objetCounts } = useHabitationObjectCounts();
  const createHabitation = useCreateHabitation();
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<HabitationTypeKey>('maison');
  const [name, setName] = useState('');
  const isEmpty = !isLoading && !isError && (habitations?.length ?? 0) === 0;

  const handleSelectType = (key: HabitationTypeKey) => {
    setType(key);
    setName(t(`inventory.habitationTypes.${key}`));
  };

  return (
    <>
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}
      {isEmpty ? <EmptyState icon="home" title={t('home.onboarding_hint')} /> : null}
      {habitations?.map((habitation) => (
        <EntityRow
          key={habitation.id}
          level="habitation"
          icon={getHabitationIcon(habitation.type)}
          title={habitation.name}
          subtitle={[t(`inventory.habitationTypes.${habitation.type}`), objetCountLabel(t, objetCounts, habitation.id)]
            .filter(Boolean)
            .join(' · ')}
          photoUri={habitation.photo_url}
          onPress={() => onSelect(habitation)}
        />
      ))}
      <AddInlineCard
        label={t('inventory.habitations.add')}
        onPress={() => {
          setType('maison');
          setName(t('inventory.habitationTypes.maison'));
          setModalOpen(true);
        }}
      />

      <CreateEntityModal
        visible={modalOpen}
        title={t('inventory.habitations.create_title')}
        nameLabel={t('inventory.habitations.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        name={name}
        onNameChange={setName}
        loading={createHabitation.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (submittedName) => {
          const definition = HABITATION_TYPES.find((h) => h.key === type)!;
          const habitation = await createHabitation.mutateAsync({ name: submittedName, type, icon: definition.icon });
          setModalOpen(false);
          onSelect(habitation);
        }}
      >
        <PresetPicker
          presets={HABITATION_TYPES}
          selectedKey={type}
          onSelect={(key) => handleSelectType(key as HabitationTypeKey)}
          labelFor={(key) => t(`inventory.habitationTypes.${key}`)}
        />
      </CreateEntityModal>
    </>
  );
}

function PiecesStep({ habitationId, onSelect }: { habitationId: string; onSelect: (piece: Piece) => void }) {
  const { iconTint } = useEntityTints();
  const { t } = useTranslation();
  const { data: pieces, isLoading, isError, refetch } = usePieces(habitationId);
  const { data: counts } = useHabitationNodeCounts(habitationId);
  const createPiece = useCreatePiece(habitationId);
  const [modalOpen, setModalOpen] = useState(false);
  const [presetKey, setPresetKey] = useState<PieceTypeKey | null>(null);
  const [name, setName] = useState('');
  const isEmpty = !isLoading && !isError && (pieces?.length ?? 0) === 0;

  const handleSelectPreset = (key: PieceTypeKey) => {
    setPresetKey(key);
    setName(t(`inventory.pieceTypes.${key}`));
  };

  return (
    <>
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}
      {isEmpty ? <EmptyState icon="piece" title={t('inventory.pieces.empty')} /> : null}
      {pieces?.map((piece) => (
        <EntityRow
          key={piece.id}
          level="piece"
          icon={getPieceIcon(piece.preset_key)}
          title={piece.name}
          subtitle={objetCountLabel(t, counts, nodeCountKey('piece', piece.id))}
          photoUri={piece.photo_url}
          iconColor={iconTint(piece.color ?? DEFAULT_PIECE_COLOR)}
          onPress={() => onSelect(piece)}
        />
      ))}
      <AddInlineCard
        label={t('inventory.pieces.add')}
        onPress={() => {
          setPresetKey(null);
          setName('');
          setModalOpen(true);
        }}
      />

      <CreateEntityModal
        visible={modalOpen}
        title={t('inventory.pieces.create_title')}
        nameLabel={t('inventory.pieces.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        name={name}
        onNameChange={setName}
        loading={createPiece.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (submittedName) => {
          const piece = await createPiece.mutateAsync({ name: submittedName, presetKey });
          setModalOpen(false);
          onSelect(piece);
        }}
      >
        <PresetPicker
          presets={PIECE_TYPES}
          selectedKey={presetKey}
          onSelect={(key) => handleSelectPreset(key as PieceTypeKey)}
          labelFor={(key) => t(`inventory.pieceTypes.${key}`)}
        />
      </CreateEntityModal>
    </>
  );
}

function EmplacementsStep({
  pieceId,
  onSelect,
  onCreated,
}: {
  pieceId: string;
  onSelect: (emplacement: Emplacement) => void;
  onCreated: (emplacement: Emplacement) => void;
}) {
  const { t } = useTranslation();
  const { data: emplacements, isLoading, isError, refetch } = useEmplacements(pieceId);
  // Les compteurs sont indexés PAR HABITATION : il faut donc remonter du
  // pieceId à son habitation, exactement comme le fait l'écran Pièce.
  const { data: habitationId } = useHabitationIdForNode('piece', pieceId);
  const { data: counts } = useHabitationNodeCounts(habitationId);
  const createEmplacement = useCreateEmplacement(pieceId);
  const [modalOpen, setModalOpen] = useState(false);
  const [presetKey, setPresetKey] = useState<EmplacementPresetKey | null>(null);
  const [name, setName] = useState('');
  const isEmpty = !isLoading && !isError && (emplacements?.length ?? 0) === 0;

  const handleSelectPreset = (key: EmplacementPresetKey) => {
    setPresetKey(key);
    setName(t(`inventory.emplacementPresets.${key}`));
  };

  return (
    <>
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}
      {isEmpty ? <EmptyState icon="etagere" title={t('inventory.emplacements.empty')} /> : null}
      {emplacements?.map((emplacement) => (
        <EntityRow
          key={emplacement.id}
          level="emplacement"
          icon={getEmplacementIcon(emplacement.preset_key)}
          title={emplacement.name}
          subtitle={objetCountLabel(t, counts, nodeCountKey('emplacement', emplacement.id))}
          photoUri={emplacement.photo_url}
          onPress={() => onSelect(emplacement)}
        />
      ))}
      <AddInlineCard
        label={t('inventory.emplacements.add')}
        onPress={() => {
          setPresetKey(null);
          setName('');
          setModalOpen(true);
        }}
      />

      <CreateEntityModal
        visible={modalOpen}
        title={t('inventory.emplacements.create_title')}
        nameLabel={t('inventory.emplacements.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        name={name}
        onNameChange={setName}
        loading={createEmplacement.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (submittedName) => {
          const emplacement = await createEmplacement.mutateAsync({ name: submittedName, presetKey });
          setModalOpen(false);
          onCreated(emplacement);
        }}
      >
        <PresetPicker
          presets={EMPLACEMENT_PRESETS}
          selectedKey={presetKey}
          onSelect={(key) => handleSelectPreset(key as EmplacementPresetKey)}
          labelFor={(key) => t(`inventory.emplacementPresets.${key}`)}
        />
      </CreateEntityModal>
    </>
  );
}

function ContainerStep({
  type,
  id,
  confirmLabel,
  loading,
  onSelectConteneur,
  onChooseHere,
  onCreatedConteneur,
}: {
  type: LocationType;
  id: string;
  confirmLabel: string;
  loading?: boolean;
  onSelectConteneur: (conteneur: Conteneur) => void;
  onChooseHere: () => void;
  onCreatedConteneur: (conteneur: Conteneur) => void;
}) {
  const { t } = useTranslation();
  const { conteneurs } = useContainerContents(type, id);
  const { data: habitationId } = useHabitationIdForNode(type, id);
  const { data: counts } = useHabitationNodeCounts(habitationId);
  const createConteneur = useCreateConteneur(type, id);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <>
      <View className="mb-4">
        <Button label={confirmLabel} onPress={onChooseHere} loading={loading} />
      </View>
      {conteneurs.map((conteneur) => (
        <EntityRow
          key={conteneur.id}
          level="conteneur"
          icon={getConteneurIcon(conteneur.preset_key)}
          title={conteneur.name}
          subtitle={objetCountLabel(t, counts, nodeCountKey('conteneur', conteneur.id))}
          photoUri={conteneur.photo_url}
          onPress={() => onSelectConteneur(conteneur)}
        />
      ))}
      <AddInlineCard
        label={t('inventory.container.add_conteneur')}
        onPress={() => {
          setName('');
          setModalOpen(true);
        }}
      />

      <CreateEntityModal
        visible={modalOpen}
        title={t('inventory.container.create_conteneur_title')}
        nameLabel={t('inventory.container.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        name={name}
        onNameChange={setName}
        loading={createConteneur.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (submittedName) => {
          const conteneur = await createConteneur.mutateAsync({ name: submittedName, presetKey: null });
          setModalOpen(false);
          onCreatedConteneur(conteneur);
        }}
      />
    </>
  );
}
