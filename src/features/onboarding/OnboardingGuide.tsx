import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { TextField } from '../../components/TextField';
import { logClientError } from '../../lib/errorLogging';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { useSession } from '../auth/SessionProvider';
import {
  CONTENEUR_PRESETS,
  EMPLACEMENT_PRESETS,
  HABITATION_TYPES,
  PIECE_TYPES,
  isSingleSpaceHabitation,
} from '../inventory/constants';
import {
  useContainerContents,
  useCreateConteneur,
  useCreateEmplacement,
  useCreateHabitation,
  useCreateObjet,
  useCreatePiece,
  useEmplacements,
  useHabitations,
  usePieces,
} from '../inventory/queries';
import { ChoiceStep, type ChoiceOption } from './ChoiceStep';
import { PathRail, levelChipClass, useLevelColor, type RailItem } from './PathRail';
import { Pop } from './Pop';
import type { LocationType } from '../../types/database';

// LE GUIDE DE DÉMARRAGE.
//
// Origine : quelqu'un a installé l'app, est arrivé sur l'accueil, et n'a su
// ni par où commencer ni à quoi elle servait. Les deux reproches se tiennent
// — l'accueil est un écran de RECHERCHE, et une recherche sur un inventaire
// vide ne montre rien, donc ne démontre rien.
//
// CE GUIDE NE MONTRE PAS L'APPLICATION, IL LA FAIT FAIRE.
//
// C'est le choix structurant, et il vaut la peine d'être écrit : un carrousel
// d'écrans d'explication aurait été plus rapide à écrire et se serait oublié
// aussi vite. Ici, chaque étape CRÉE POUR DE VRAI la chose dont elle parle.
// À la fin, la personne n'a pas lu ce qu'est un emplacement : elle en a un,
// avec son premier objet rangé dedans, et elle a vu le chemin se construire
// maillon par maillon dans le fil du haut. C'est ce chemin, exactement, que
// l'app lui répondra le jour où elle cherchera cet objet.
//
// Conséquence assumée : quelqu'un qui abandonne en cours de route garde ce
// qui a déjà été créé. Ce n'est pas un déchet — c'est son vrai logement, avec
// le nom qu'il aurait choisi de toute façon, et il se renomme comme le reste.
//
// TROIS CHOIX PLUS PETITS, mais qui expliquent le code :
//
// - Seuls MAISON et APPARTEMENT sont proposés à la création. Les autres types
//   (garage, cave, véhicule) n'ont pas de couche Pièce visible — ils sont
//   `singleSpace` — et sauteraient donc la leçon principale. On les ajoute
//   très bien après, depuis l'écran Habitations.
// - La proposition « Autre » est retirée de toutes les listes : elle créerait
//   une pièce réellement nommée « Autre ».
// - Le CONTENEUR est une question, pas une étape obligatoire. Tout le monde
//   n'a pas de boîte dans son tiroir, et demander « et dans ce rangement, une
//   boîte ? » enseigne la notion mieux qu'un écran de plus.

const STEPS = ['welcome', 'principle', 'habitation', 'piece', 'emplacement', 'conteneur', 'objet', 'done'] as const;
type StepId = (typeof STEPS)[number];

type PickedHabitation = { id: string; name: string; icon: IconName; type: string };
type Picked = { id: string; name: string; icon: IconName };
/** La Pièce unique et masquée d'une habitation mono-espace ne s'affiche pas dans le fil. */
type PickedPiece = Picked & { hidden: boolean };

type OnboardingGuideProps = {
  visible: boolean;
  onClose: () => void;
};

export function OnboardingGuide({ visible, onClose }: OnboardingGuideProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const spacerWidth = useScaled(22);

  const [step, setStep] = useState<StepId>('welcome');
  const [habitation, setHabitation] = useState<PickedHabitation | null>(null);
  const [piece, setPiece] = useState<PickedPiece | null>(null);
  const [emplacement, setEmplacement] = useState<Picked | null>(null);
  const [conteneur, setConteneur] = useState<Picked | null>(null);
  const [objet, setObjet] = useState<Picked | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep('welcome');
    setHabitation(null);
    setPiece(null);
    setEmplacement(null);
    setConteneur(null);
    setObjet(null);
  }, [visible]);

  // Une seule zone défilante pour tout le guide : sans remise à zéro, une
  // grille de propositions parcourue jusqu'en bas laisserait l'étape suivante
  // s'ouvrir au milieu de nulle part, titre déjà hors de l'écran.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const ratio = STEPS.indexOf(step) / (STEPS.length - 1);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // `useNativeDriver: false` obligatoire : une largeur n'est pas une
    // propriété que le fil natif sait animer seul.
    Animated.timing(progress, { toValue: ratio, duration: 280, useNativeDriver: false }).start();
  }, [ratio, progress]);

  const singleSpace = habitation ? isSingleSpaceHabitation(habitation.type) : false;

  const rail: RailItem[] = [];
  if (habitation) rail.push({ level: 'habitation', icon: habitation.icon, label: habitation.name });
  if (piece && !piece.hidden) rail.push({ level: 'piece', icon: piece.icon, label: piece.name });
  if (emplacement) rail.push({ level: 'emplacement', icon: emplacement.icon, label: emplacement.name });
  if (conteneur) rail.push({ level: 'conteneur', icon: conteneur.icon, label: conteneur.name });
  if (objet) rail.push({ level: 'objet', icon: 'objet', label: objet.name });

  const canGoBack = step !== 'welcome' && step !== 'done';
  const back = () => {
    if (step === 'principle') setStep('welcome');
    else if (step === 'habitation') setStep('principle');
    else if (step === 'piece') setStep('habitation');
    // Depuis une habitation mono-espace, l'étape Pièce est traversée sans
    // rien afficher : y revenir en arrière la retraverserait aussitôt dans
    // l'autre sens, et le bouton Retour ne ferait rien.
    else if (step === 'emplacement') setStep(singleSpace ? 'habitation' : 'piece');
    else if (step === 'conteneur') setStep('emplacement');
    else if (step === 'objet') setStep('conteneur');
  };

  const pathText = [habitation?.name, piece?.hidden ? null : piece?.name, emplacement?.name, conteneur?.name]
    .filter(Boolean)
    .join(' › ');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => (canGoBack ? back() : onClose())}
    >
      {/* Un `Modal` ouvre sa PROPRE fenêtre native : elle ne profite pas du
          redimensionnement clavier de l'écran qui l'a ouverte. Sans ça, le
          clavier de l'étape « ton premier objet » se poserait par-dessus le
          bouton qui la valide (voir la même précaution dans
          BottomSheetModal). */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-sand pt-16"
      >
        <View className="mb-4 flex-row items-center gap-3 px-6">
          {canGoBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={back} hitSlop={8}>
              <Icon name="back" size={22} color={colors.ink} />
            </Pressable>
          ) : (
            <View style={{ width: spacerWidth }} />
          )}

          <View
            // Annoncé « étape 3 sur 8 » plutôt que comme un trait décoratif :
            // au lecteur d'écran, une barre de progression muette ne dit pas
            // combien il reste à faire.
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 1, max: STEPS.length, now: STEPS.indexOf(step) + 1 }}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"
          >
            {/* Tout en `style`, RIEN en `className` : sur cette vue animée,
                les classes utilitaires sont perdues en route (vérifié dans le
                navigateur — le remplissage y ressortait transparent et de
                hauteur nulle). La largeur devant de toute façon venir de la
                valeur animée, autant que la couleur et l'arrondi viennent du
                même endroit. */}
            <Animated.View
              style={{
                height: '100%',
                borderRadius: 999,
                backgroundColor: colors.accent,
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }}
            />
          </View>

          {step === 'welcome' || step === 'done' ? (
            <View style={{ width: spacerWidth }} />
          ) : (
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text className="text-label font-semibold text-ink-soft">{t('onboarding.skip')}</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          // Le clavier est ouvert à l'étape de l'objet : sans ça, le premier
          // appui sur « Le ranger ici » ne ferait que refermer le clavier.
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow px-6 pb-16"
        >
          {rail.length > 0 ? (
            <View className="mb-6">
              <PathRail items={rail} />
            </View>
          ) : null}

          {step === 'welcome' ? <WelcomeStep onStart={() => setStep('principle')} onLater={onClose} /> : null}

          {step === 'principle' ? <PrincipleStep onNext={() => setStep('habitation')} /> : null}

          {step === 'habitation' ? (
            <HabitationStep
              onPicked={(picked) => {
                setHabitation(picked);
                // Tout ce qui vivait sous l'ancienne habitation n'a plus de
                // sens : revenir en arrière puis changer d'avis ne doit pas
                // laisser une pièce orpheline dans le fil.
                setPiece(null);
                setEmplacement(null);
                setConteneur(null);
                setStep('piece');
              }}
            />
          ) : null}

          {step === 'piece' && habitation ? (
            <PieceStep
              habitation={habitation}
              onPicked={(picked) => {
                setPiece(picked);
                setEmplacement(null);
                setConteneur(null);
                setStep('emplacement');
              }}
            />
          ) : null}

          {step === 'emplacement' && piece ? (
            <EmplacementStep
              piece={piece}
              onPicked={(picked) => {
                setEmplacement(picked);
                setConteneur(null);
                setStep('conteneur');
              }}
            />
          ) : null}

          {step === 'conteneur' && emplacement ? (
            <ConteneurStep
              emplacement={emplacement}
              onPicked={(picked) => {
                setConteneur(picked);
                setStep('objet');
              }}
              onSkip={() => {
                setConteneur(null);
                setStep('objet');
              }}
            />
          ) : null}

          {step === 'objet' && emplacement ? (
            <ObjetStep
              parentType={conteneur ? 'conteneur' : 'emplacement'}
              parentId={conteneur ? conteneur.id : emplacement.id}
              onCreated={(picked) => {
                setObjet(picked);
                setStep('done');
              }}
            />
          ) : null}

          {step === 'done' && objet ? <DoneStep objetName={objet.name} path={pathText} onFinish={onClose} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// === Étape 1 : à quoi sert cette application ==========================

function WelcomeStep({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View className="grow justify-center">
      <Pop>
        <View className="mb-6 items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-coral-light">
            <Icon name="wave" size={40} color={colors.accentDark} />
          </View>
        </View>
      </Pop>

      <Pop delay={120}>
        <Text className="mb-3 text-center text-title font-bold text-ink">{t('onboarding.welcome.title')}</Text>
        <Text className="mb-3 text-center text-body text-ink-soft">{t('onboarding.welcome.body')}</Text>
        <Text className="mb-8 text-center text-body text-ink-soft">{t('onboarding.welcome.body2')}</Text>
      </Pop>

      <Button label={t('onboarding.welcome.start')} onPress={onStart} />
      <View className="mt-2">
        <Button label={t('onboarding.welcome.later')} variant="ghost" onPress={onLater} />
      </View>
    </View>
  );
}

// === Étape 2 : le principe des poupées russes =========================

function PrincipleStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const levelColor = useLevelColor();
  // L'indentation est ce qui DIT l'emboîtement : elle grandit donc avec le
  // texte, sinon elle disparaîtrait sous des noms deux fois plus gros.
  const indent = useScaled(14);

  const levels = [
    {
      level: 'habitation' as const,
      icon: 'maison' as IconName,
      example: t('onboarding.principle.levels.habitation.example'),
      role: t('onboarding.principle.levels.habitation.role'),
    },
    {
      level: 'piece' as const,
      icon: 'cuisine' as IconName,
      example: t('onboarding.principle.levels.piece.example'),
      role: t('onboarding.principle.levels.piece.role'),
    },
    {
      level: 'emplacement' as const,
      icon: 'commode' as IconName,
      example: t('onboarding.principle.levels.emplacement.example'),
      role: t('onboarding.principle.levels.emplacement.role'),
    },
    {
      level: 'conteneur' as const,
      icon: 'boite' as IconName,
      example: t('onboarding.principle.levels.conteneur.example'),
      role: t('onboarding.principle.levels.conteneur.role'),
    },
    {
      level: 'objet' as const,
      icon: 'objet' as IconName,
      example: t('onboarding.principle.levels.objet.example'),
      role: t('onboarding.principle.levels.objet.role'),
    },
  ];

  return (
    <View>
      <Text className="mb-1 text-title font-bold text-ink">{t('onboarding.principle.title')}</Text>
      <Text className="mb-6 text-body text-ink-soft">{t('onboarding.principle.intro')}</Text>

      {levels.map((entry, index) => (
        // Décalées l'une après l'autre : l'emboîtement se voit en train de se
        // faire, ce qu'une pile déjà en place ne raconterait pas.
        <Pop key={entry.level} delay={index * 110}>
          <View
            style={{ marginLeft: index * indent }}
            className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface px-3 py-2.5"
          >
            <View className={`h-10 w-10 items-center justify-center rounded-full ${levelChipClass(entry.level)}`}>
              <Icon name={entry.icon} size={20} color={levelColor(entry.level)} />
            </View>
            <View className="flex-1">
              <Text className="text-body font-semibold text-ink">{entry.example}</Text>
              <Text className="text-caption text-ink-soft">{entry.role}</Text>
            </View>
          </View>
        </Pop>
      ))}

      <Pop delay={levels.length * 110}>
        <Text className="mb-6 mt-5 text-body text-ink-soft">{t('onboarding.principle.outro')}</Text>
        <Button label={t('onboarding.principle.next')} onPress={onNext} />
      </Pop>
    </View>
  );
}

// === Étape 3 : le logement ============================================

function HabitationStep({ onPicked }: { onPicked: (picked: PickedHabitation) => void }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: habitations } = useHabitations();
  const createHabitation = useCreateHabitation();

  // Les habitations d'un ami n'ont rien à faire ici : le guide fait ranger
  // chez soi, et rien ne garantit un droit d'écriture ailleurs.
  const mine = (habitations ?? []).filter((item) => item.user_id === session?.user.id);

  const presets = HABITATION_TYPES.filter((definition) => !definition.singleSpace);

  const handlePreset = async (option: ChoiceOption) => {
    const definition = HABITATION_TYPES.find((item) => item.key === option.key);
    if (!definition) return;
    try {
      const created = await createHabitation.mutateAsync({
        name: option.label,
        type: definition.key,
        icon: definition.icon,
      });
      onPicked({ id: created.id, name: created.name, icon: definition.icon, type: definition.key });
    } catch (err) {
      logClientError(err, { source: 'onboarding', step: 'habitation' });
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <ChoiceStep
      level="habitation"
      title={t('onboarding.habitation.title')}
      hint={t('onboarding.habitation.hint')}
      existing={mine.map((item) => ({ key: item.id, icon: (item.icon as IconName) ?? 'maison', label: item.name }))}
      existingTitle={t('onboarding.habitation.existing_title')}
      presets={presets.map((definition) => ({
        key: definition.key,
        icon: definition.icon,
        label: t(`inventory.habitationTypes.${definition.key}`),
      }))}
      presetsTitle={t('onboarding.habitation.presets_title')}
      busy={createHabitation.isPending}
      onPickExisting={(option) => {
        const found = mine.find((item) => item.id === option.key);
        if (found) {
          onPicked({ id: found.id, name: found.name, icon: (found.icon as IconName) ?? 'maison', type: found.type });
        }
      }}
      onPickPreset={handlePreset}
      footer={<Text className="text-label text-ink-soft">{t('onboarding.habitation.foot')}</Text>}
    />
  );
}

// === Étape 4 : la pièce ===============================================

function PieceStep({
  habitation,
  onPicked,
}: {
  habitation: PickedHabitation;
  onPicked: (picked: PickedPiece) => void;
}) {
  const { t } = useTranslation();
  const { data: pieces, isSuccess } = usePieces(habitation.id);
  const createPiece = useCreatePiece(habitation.id);

  // Un garage, une cave ou une voiture n'ont pas de pièces : l'app leur en
  // crée une, unique et masquée, à la création de l'habitation. L'étape est
  // donc traversée sans rien demander — mais elle doit quand même passer par
  // là, parce que c'est cette pièce invisible qui portera le rangement.
  const singleSpace = isSingleSpaceHabitation(habitation.type);
  // Le verrou est posé AVANT l'appel asynchrone, et c'est ce qui rend l'effet
  // sûr : il se redéclenche à chaque rendu (la mutation change d'identité),
  // mais ne travaille qu'une fois.
  const resolved = useRef(false);
  useEffect(() => {
    if (!singleSpace || resolved.current || !isSuccess) return;
    const hidden = (pieces ?? []).find((item) => item.is_default) ?? (pieces ?? [])[0];
    if (hidden) {
      resolved.current = true;
      onPicked({ id: hidden.id, name: hidden.name, icon: 'piece', hidden: true });
      return;
    }
    // AUCUNE pièce alors qu'il en faudrait une. La création d'une habitation
    // n'est pas transactionnelle : l'insertion de la ligne peut réussir et
    // celle de sa pièce échouer juste après. Le guide répare au lieu de
    // tourner indéfiniment sur son indicateur de chargement.
    resolved.current = true;
    createPiece
      .mutateAsync({ name: habitation.name, presetKey: null })
      .then((created) => onPicked({ id: created.id, name: created.name, icon: 'piece', hidden: true }))
      .catch((err) => {
        resolved.current = false;
        logClientError(err, { source: 'onboarding', step: 'piece_repair' });
        Alert.alert(t('common.error_generic'));
      });
  }, [singleSpace, isSuccess, pieces, onPicked, createPiece, habitation.name, t]);

  const handlePreset = async (option: ChoiceOption) => {
    try {
      const created = await createPiece.mutateAsync({ name: option.label, presetKey: option.key });
      onPicked({ id: created.id, name: created.name, icon: option.icon, hidden: false });
    } catch (err) {
      logClientError(err, { source: 'onboarding', step: 'piece' });
      Alert.alert(t('common.error_generic'));
    }
  };

  if (singleSpace) {
    return (
      <View className="grow items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const visible = (pieces ?? []).filter((item) => !item.is_default);

  return (
    <ChoiceStep
      level="piece"
      title={t('onboarding.piece.title')}
      hint={t('onboarding.piece.hint')}
      existing={visible.map((item) => ({
        key: item.id,
        icon: pieceIcon(item.preset_key),
        label: item.name,
      }))}
      existingTitle={t('onboarding.piece.existing_title')}
      presets={PIECE_TYPES.filter((definition) => definition.key !== 'autre').map((definition) => ({
        key: definition.key,
        icon: definition.icon,
        label: t(`inventory.pieceTypes.${definition.key}`),
      }))}
      presetsTitle={t('onboarding.piece.presets_title')}
      busy={createPiece.isPending}
      onPickExisting={(option) => {
        const found = visible.find((item) => item.id === option.key);
        if (found) onPicked({ id: found.id, name: found.name, icon: option.icon, hidden: false });
      }}
      onPickPreset={handlePreset}
    />
  );
}

function pieceIcon(presetKey: string | null): IconName {
  return PIECE_TYPES.find((definition) => definition.key === presetKey)?.icon ?? 'piece';
}

// === Étape 5 : le rangement ===========================================

function EmplacementStep({ piece, onPicked }: { piece: PickedPiece; onPicked: (picked: Picked) => void }) {
  const { t } = useTranslation();
  const { data: emplacements } = useEmplacements(piece.id);
  const createEmplacement = useCreateEmplacement(piece.id);

  // « Boîte à gants » est une proposition de véhicule : dans une chambre ou
  // une cuisine, elle n'aide personne à comprendre ce qu'est un rangement.
  const presets = EMPLACEMENT_PRESETS.filter(
    (definition) => definition.key !== 'autre' && definition.key !== 'boite_a_gants',
  );

  const handlePreset = async (option: ChoiceOption) => {
    try {
      const created = await createEmplacement.mutateAsync({ name: option.label, presetKey: option.key });
      onPicked({ id: created.id, name: created.name, icon: option.icon });
    } catch (err) {
      logClientError(err, { source: 'onboarding', step: 'emplacement' });
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <ChoiceStep
      level="emplacement"
      title={t('onboarding.emplacement.title')}
      hint={t('onboarding.emplacement.hint')}
      existing={(emplacements ?? []).map((item) => ({
        key: item.id,
        icon: emplacementIcon(item.preset_key),
        label: item.name,
      }))}
      existingTitle={t('onboarding.emplacement.existing_title')}
      presets={presets.map((definition) => ({
        key: definition.key,
        icon: definition.icon,
        label: t(`inventory.emplacementPresets.${definition.key}`),
      }))}
      presetsTitle={t('onboarding.emplacement.presets_title')}
      busy={createEmplacement.isPending}
      onPickExisting={(option) => {
        const found = (emplacements ?? []).find((item) => item.id === option.key);
        if (found) onPicked({ id: found.id, name: found.name, icon: option.icon });
      }}
      onPickPreset={handlePreset}
    />
  );
}

function emplacementIcon(presetKey: string | null): IconName {
  return EMPLACEMENT_PRESETS.find((definition) => definition.key === presetKey)?.icon ?? 'conteneur';
}

// === Étape 6 : la boîte, si elle existe ===============================

function ConteneurStep({
  emplacement,
  onPicked,
  onSkip,
}: {
  emplacement: Picked;
  onPicked: (picked: Picked) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const { conteneurs } = useContainerContents('emplacement', emplacement.id);
  const createConteneur = useCreateConteneur('emplacement', emplacement.id);

  const handlePreset = async (option: ChoiceOption) => {
    try {
      const created = await createConteneur.mutateAsync({ name: option.label, presetKey: option.key });
      onPicked({ id: created.id, name: created.name, icon: option.icon });
    } catch (err) {
      logClientError(err, { source: 'onboarding', step: 'conteneur' });
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <ChoiceStep
      level="conteneur"
      title={t('onboarding.conteneur.title')}
      hint={t('onboarding.conteneur.hint')}
      existing={conteneurs.map((item) => ({
        key: item.id,
        icon: conteneurIcon(item.preset_key),
        label: item.name,
      }))}
      existingTitle={t('onboarding.conteneur.existing_title')}
      presets={CONTENEUR_PRESETS.filter((definition) => definition.key !== 'autre').map((definition) => ({
        key: definition.key,
        icon: definition.icon,
        label: t(`inventory.conteneurPresets.${definition.key}`),
      }))}
      presetsTitle={t('onboarding.conteneur.presets_title')}
      busy={createConteneur.isPending}
      onPickExisting={(option) => {
        const found = conteneurs.find((item) => item.id === option.key);
        if (found) onPicked({ id: found.id, name: found.name, icon: option.icon });
      }}
      onPickPreset={handlePreset}
      // L'échappatoire est un vrai bouton, pas un lien discret : ne pas avoir
      // de boîte est le cas le plus courant, ce n'est pas un renoncement.
      footer={<Button label={t('onboarding.conteneur.skip')} variant="outline" onPress={onSkip} />}
    />
  );
}

function conteneurIcon(presetKey: string | null): IconName {
  return CONTENEUR_PRESETS.find((definition) => definition.key === presetKey)?.icon ?? 'conteneur';
}

// === Étape 7 : le premier objet =======================================

function ObjetStep({
  parentType,
  parentId,
  onCreated,
}: {
  parentType: LocationType;
  parentId: string;
  onCreated: (picked: Picked) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const createObjet = useCreateObjet();

  // Le seul champ libre du guide, et il ne peut pas être remplacé par des
  // propositions : personne ne peut deviner ce que cette personne-là range.
  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await createObjet.mutateAsync({
        parentType,
        parentId,
        name: trimmed,
        description: null,
        photoUrl: null,
      });
      onCreated({ id: created.id, name: created.name, icon: 'objet' });
    } catch (err) {
      logClientError(err, { source: 'onboarding', step: 'objet' });
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <View>
      <Text className="mb-1 text-title font-bold text-ink">{t('onboarding.objet.title')}</Text>
      <Text className="mb-5 text-body text-ink-soft">{t('onboarding.objet.hint')}</Text>

      <TextField
        label={t('onboarding.objet.name_label')}
        value={name}
        onChangeText={setName}
        placeholder={t('onboarding.objet.name_placeholder')}
        autoFocus
      />

      <Button
        label={t('onboarding.objet.submit')}
        onPress={handleSubmit}
        loading={createObjet.isPending}
        disabled={!name.trim()}
      />
    </View>
  );
}

// === Étape 8 : la récompense ==========================================

function DoneStep({ objetName, path, onFinish }: { objetName: string; path: string; onFinish: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View>
      <Pop>
        <View className="mb-5 items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-mustard-light">
            <Icon name="celebrate" size={40} color={colors.mustardDark} />
          </View>
        </View>
      </Pop>

      <Text className="mb-3 text-center text-title font-bold text-ink">{t('onboarding.done.title')}</Text>
      <Text className="mb-6 text-center text-body text-ink-soft">
        {t('onboarding.done.search_hint', { name: objetName })}
      </Text>

      {/* LA DÉMONSTRATION, et pas une illustration : c'est à l'identique ce
          que l'accueil affichera, avec le nom que la personne vient d'entrer
          et le chemin qu'elle vient de construire. La promesse de l'app se
          vérifie ici, sur ses propres affaires. */}
      <Pop delay={200}>
        <View className="mb-6 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
          <View className="flex-row items-center gap-2 border-b border-ink/10 px-4 py-3">
            <Icon name="search" size={18} color={colors.inkFaint} />
            <Text className="text-body text-ink-soft">{objetName.toLowerCase()}</Text>
          </View>
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-coral-light">
              <Icon name="objet" size={20} color={colors.accentDark} />
            </View>
            <View className="flex-1">
              <Text className="text-body font-semibold text-ink">{objetName}</Text>
              <Text className="text-caption text-ink-soft">{path}</Text>
            </View>
          </View>
        </View>
      </Pop>

      <View className="mb-6 flex-row items-start gap-2 rounded-2xl bg-teal-light px-4 py-3">
        <Icon name="microphone" size={18} color={colors.tealDark} />
        <Text className="flex-1 text-label text-teal-dark">{t('onboarding.done.voice_hint')}</Text>
      </View>

      <Text className="mb-6 text-body text-ink-soft">{t('onboarding.done.next_steps')}</Text>

      <Button label={t('onboarding.done.finish')} onPress={onFinish} />
    </View>
  );
}
