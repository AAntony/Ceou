import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import { EntityGrid } from '../../components/EntityGrid';
import { ErrorState } from '../../components/ErrorState';
import { Icon } from '../../components/Icon';
import { PresetPicker } from '../../components/PresetPicker';
import { supabase } from '../../lib/supabase/client';
import type { Conteneur, Emplacement, Habitation, LocationType, Piece } from '../../types/database';
import {
  EMPLACEMENT_PRESETS,
  HABITATION_TYPES,
  PIECE_TYPES,
  getEmplacementIcon,
  getHabitationIcon,
  getPieceIcon,
  isSingleSpaceHabitation,
  type EmplacementPresetKey,
  type HabitationTypeKey,
  type PieceTypeKey,
} from './constants';
import {
  useContainerContents,
  useCreateConteneur,
  useCreateEmplacement,
  useCreateHabitation,
  useCreatePiece,
  useEmplacements,
  useHabitations,
  usePieces,
} from './queries';

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
// Règle d'ergonomie : à AUCUN niveau l'utilisateur ne doit se retrouver
// devant une liste vide sans issue. Chaque étape propose donc une création
// à la volée (habitation/pièce/emplacement/conteneur) qui enchaîne
// automatiquement sur l'étape suivante — la création d'un Emplacement ou
// d'un Conteneur (niveaux terminaux, ceux qu'un objet peut effectivement
// habiter) va même jusqu'à appeler `onChoose` directement : un
// emplacement/conteneur tout juste créé est forcément vide, l'étape de
// confirmation intermédiaire n'apporterait rien.
export function LocationTreePicker({ active, confirmLabel, loading, onChoose }: LocationTreePickerProps) {
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
          <Icon name="back" size={16} color="#6B6459" />
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
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 flex-row items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-coral bg-coral-light px-4 py-3 active:opacity-70"
    >
      <Icon name="add" size={18} color="#0B5E9E" />
      <Text className="text-base font-semibold text-coral-dark">{label}</Text>
    </Pressable>
  );
}

function HabitationsStep({ onSelect }: { onSelect: (habitation: Habitation) => void }) {
  const { t } = useTranslation();
  const { data: habitations, isLoading, isError, refetch } = useHabitations();
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
      <EntityGrid>
        {habitations?.map((habitation) => (
          <EntityCard key={habitation.id} icon={getHabitationIcon(habitation.type)} title={habitation.name} onPress={() => onSelect(habitation)} />
        ))}
      </EntityGrid>
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
  const { t } = useTranslation();
  const { data: pieces, isLoading, isError, refetch } = usePieces(habitationId);
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
      <EntityGrid>
        {pieces?.map((piece) => (
          <EntityCard key={piece.id} icon={getPieceIcon(piece.preset_key)} title={piece.name} onPress={() => onSelect(piece)} />
        ))}
      </EntityGrid>
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
      <EntityGrid>
        {emplacements?.map((emplacement) => (
          <EntityCard
            key={emplacement.id}
            icon={getEmplacementIcon(emplacement.preset_key)}
            title={emplacement.name}
            onPress={() => onSelect(emplacement)}
          />
        ))}
      </EntityGrid>
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
  const createConteneur = useCreateConteneur(type, id);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <>
      <View className="mb-4">
        <Button label={confirmLabel} onPress={onChooseHere} loading={loading} />
      </View>
      <EntityGrid>
        {conteneurs.map((conteneur) => (
          <EntityCard key={conteneur.id} icon="conteneur" title={conteneur.name} onPress={() => onSelectConteneur(conteneur)} />
        ))}
      </EntityGrid>
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
          const conteneur = await createConteneur.mutateAsync(submittedName);
          setModalOpen(false);
          onCreatedConteneur(conteneur);
        }}
      />
    </>
  );
}
