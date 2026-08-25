import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { STACK_SCALE, useTextScale } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { levelChipClass, useLevelColor, type GuideLevel } from './PathRail';

// UNE QUESTION, DES RÉPONSES À TAPER — jamais un champ vide.
//
// Le guide s'adresse d'abord à quelqu'un qui ne sait pas par où commencer.
// Un formulaire lui demanderait d'inventer le nom de sa pièce ; une grille de
// propositions lui demande seulement de reconnaître la sienne. C'est la même
// idée que les catégories déjà proposées ailleurs dans l'app à la création,
// poussée jusqu'au bout : ici il n'y a QUE des propositions.
//
// Les entités déjà créées passent AVANT les propositions. À la première
// utilisation il n'y en a aucune, la section n'existe pas ; en revanche
// quelqu'un qui rejoue le guide depuis son Profil doit pouvoir repasser par
// sa vraie cuisine plutôt que d'en créer une deuxième.

export type ChoiceOption = {
  key: string;
  icon: IconName;
  label: string;
};

type ChoiceStepProps = {
  level: GuideLevel;
  title: string;
  hint: string;
  /** Ce qui existe déjà à ce niveau, réutilisable tel quel. */
  existing: ChoiceOption[];
  existingTitle: string;
  presets: ChoiceOption[];
  presetsTitle: string;
  busy?: boolean;
  onPickExisting: (option: ChoiceOption) => void;
  onPickPreset: (option: ChoiceOption) => void;
  /** Une échappatoire propre à l'étape (« non, pas de boîte »). */
  footer?: ReactNode;
};

export function ChoiceStep({
  level,
  title,
  hint,
  existing,
  existingTitle,
  presets,
  presetsTitle,
  busy,
  onPickExisting,
  onPickPreset,
  footer,
}: ChoiceStepProps) {
  const colors = useThemeColors();
  const levelColor = useLevelColor();
  const { textScale } = useTextScale();
  // En gros texte, deux cartes côte à côte ne laissent plus qu'un mot coupé
  // sous chaque pastille — même seuil que les rangées de l'inventaire.
  const cardWidth = textScale >= STACK_SCALE ? '100%' : '47.5%';

  return (
    <View>
      <Text className="mb-1 text-title font-bold text-ink">{title}</Text>
      <Text className="mb-5 text-body text-ink-soft">{hint}</Text>

      {busy ? <ActivityIndicator className="mb-4" /> : null}

      {existing.length > 0 ? (
        <View className="mb-6">
          <Text className="mb-2 text-label font-semibold text-ink-soft">{existingTitle}</Text>
          {existing.map((option) => (
            <Pressable
              key={option.key}
              disabled={busy}
              onPress={() => onPickExisting(option)}
              accessibilityRole="button"
              className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface px-3 py-3 active:opacity-70"
            >
              <View className={`h-10 w-10 items-center justify-center rounded-full ${levelChipClass(level)}`}>
                <Icon name={option.icon} size={20} color={levelColor(level)} />
              </View>
              <Text className="flex-1 text-body font-semibold text-ink">{option.label}</Text>
              <Icon name="chevron" size={20} color={colors.inkFaint} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {existing.length > 0 ? (
        <Text className="mb-2 text-label font-semibold text-ink-soft">{presetsTitle}</Text>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {presets.map((option) => (
          <Pressable
            key={option.key}
            disabled={busy}
            onPress={() => onPickPreset(option)}
            accessibilityRole="button"
            style={{ width: cardWidth }}
            className="items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 py-4 active:opacity-70"
          >
            <View className={`h-12 w-12 items-center justify-center rounded-full ${levelChipClass(level)}`}>
              <Icon name={option.icon} size={24} color={levelColor(level)} />
            </View>
            <Text className="text-center text-label font-semibold text-ink">{option.label}</Text>
          </Pressable>
        ))}
      </View>

      {footer ? <View className="mt-6">{footer}</View> : null}
    </View>
  );
}
