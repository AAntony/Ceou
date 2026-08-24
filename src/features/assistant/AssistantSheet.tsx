import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { getEmplacementIcon } from '../inventory/constants';
import type { MoveDestination } from './move';
import { locationLabel } from './resolve';
import type { AssistantState } from './useAssistant';
import { useThemeColors } from '../../lib/theme';

// La feuille d'une SESSION vocale.
//
// Elle ne demande rien tant qu'il n'y a rien à demander. Ce qui s'y passe est
// un compte rendu : ce que Céoù a entendu, ce qu'il a répondu, ce qu'il a
// rangé. Une seule question peut l'interrompre — laquelle des propositions —
// et y répondre exécute aussitôt : le choix VAUT accord.
//
// Un seul bouton en bas, et il n'est qu'un filet : la sortie normale se dit à
// voix haute, « merci ».

const ACCENT = '#1591EA';

/** Un meuble porte l'icône de son type, une boîte celle des conteneurs. */
function destinationIcon(destination: MoveDestination): IconName {
  return destination.type === 'conteneur' ? 'conteneur' : getEmplacementIcon(destination.presetKey);
}

function ChoiceRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      className="flex-row items-center gap-3 border-b border-ink/5 py-3 active:opacity-70"
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-coral-light">
        <Icon name={icon} size={18} color={ACCENT} />
      </View>
      <View className="flex-1">
        <Text className="text-base text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-ink-soft" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

export function AssistantSheet({
  state,
  onClose,
  onChooseObjet,
  onChooseDestination,
  onSkipChoice,
  onUndoMove,
}: {
  state: AssistantState;
  onClose: () => void;
  onChooseObjet: (objetId: string | null) => void;
  onChooseDestination: (destinationId: string | null) => void;
  onSkipChoice: () => void;
  onUndoMove: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const draft = state.move;
  const choosing = state.status === 'choosing' && draft;
  const working = state.status === 'thinking' || state.status === 'moving';

  // Le plus récent en haut : c'est celui qu'on veut vérifier, et c'est aussi
  // celui que « Annuler » vise.
  const recent = [...state.entries].reverse();

  const subtitle = choosing
    ? t('assistant.session.choosing')
    : state.status === 'starting'
      ? t('assistant.session.starting')
      : state.status === 'thinking'
        ? t('assistant.thinking')
        : state.status === 'moving'
          ? t('assistant.session.saving')
          : t('assistant.session.listening');

  return (
    <BottomSheetModal
      visible={state.active}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-surface px-5 pb-4 pt-5"
      sheetStyle={{ maxHeight: '85%' }}
    >
      {/* Le bandeau reste tout du long : c'est lui qui dit si Céoù écoute
          vraiment. « Un instant » plutôt qu'un faux « je t'écoute » évite de
          parler avant que le micro soit prêt. */}
      <View className="mb-4 flex-row items-center gap-3 rounded-2xl bg-coral-light px-4 py-3">
        {working || state.status === 'starting' ? (
          <ActivityIndicator color={ACCENT} />
        ) : (
          <Icon name="microphone" size={20} color={ACCENT} />
        )}
        <View className="flex-1">
          <Text className="text-sm font-semibold text-coral-dark">{t('assistant.session.title')}</Text>
          <Text className="text-xs text-ink-soft" numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        {state.entries.length > 0 ? (
          <Text className="text-xs font-semibold text-coral-dark">
            {t('assistant.session.count', { count: state.entries.length })}
          </Text>
        ) : null}
      </View>

      {/* Ce que l'app a compris, affiché tel quel : c'est la seule façon de
          comprendre une réponse à côté de la plaque — la dictée a pu entendre
          autre chose que ce qui a été dit. */}
      {state.transcript ? (
        <View className="mb-3 flex-row items-start gap-2">
          <Icon name="microphone" size={14} color={colors.inkFaint} />
          <Text className="flex-1 text-xs italic leading-5 text-ink-soft">« {state.transcript} »</Text>
        </View>
      ) : null}

      {/* === La seule interruption possible : lever une ambiguïté ========== */}
      {choosing ? (
        <>
          <Text className="mb-2 text-lg font-semibold leading-7 text-ink">
            {!draft.objetId
              ? t('assistant.move.which_object', { n: draft.objets.length })
              : t('assistant.move.which_destination', { n: draft.destinations.length })}
          </Text>
          <ScrollView style={{ maxHeight: 300, flexShrink: 1 }}>
            {!draft.objetId
              ? draft.objets.map((objet) => (
                  <ChoiceRow
                    key={objet.id}
                    icon="objet"
                    title={objet.name}
                    subtitle={locationLabel(objet)}
                    onPress={() => onChooseObjet(objet.id)}
                  />
                ))
              : draft.destinations.map((destination) => (
                  <ChoiceRow
                    key={destination.id}
                    icon={destinationIcon(destination)}
                    title={destination.name}
                    subtitle={destination.label}
                    onPress={() => onChooseDestination(destination.id)}
                  />
                ))}
          </ScrollView>
          <View className="mt-3">
            <Button label={t('assistant.move.skip')} variant="ghost" onPress={onSkipChoice} />
          </View>
        </>
      ) : (
        <>
          {state.answer ? (
            <Text className="mb-3 text-base leading-6 text-ink">{state.answer}</Text>
          ) : state.entries.length === 0 && !working ? (
            <Text className="mb-3 text-base leading-6 text-ink-soft">{t('assistant.session.example')}</Text>
          ) : null}

          {/* Les objets trouvés par une question posée en passant (« où sont
              mes clés ») restent cliquables, sans interrompre la session. */}
          {state.result && state.result.entries.length > 0 ? (
            <ScrollView style={{ maxHeight: 200, flexShrink: 1 }}>
              {state.result.entries.map((entry) => (
                <ChoiceRow
                  key={entry.id}
                  icon="objet"
                  title={entry.name}
                  subtitle={locationLabel(entry)}
                  onPress={() => {
                    onClose();
                    router.push(`/objet/${entry.id}`);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}

          {recent.length > 0 ? (
            <ScrollView style={{ maxHeight: 240, flexShrink: 1 }}>
              {recent.map((entry, index) => (
                <View
                  key={`${entry.objetName}-${recent.length - index}`}
                  className="flex-row items-center gap-3 border-b border-ink/5 py-2.5"
                >
                  <Icon name="validate" size={16} color={colors.inkFaint} />
                  <View className="flex-1">
                    <Text className="text-sm text-ink" numberOfLines={1}>
                      {entry.objetName}
                    </Text>
                    <Text className="text-xs text-ink-soft" numberOfLines={1}>
                      {entry.location}
                    </Text>
                  </View>
                  {/* Discret et sur la seule ligne concernée : c'est un filet,
                      pas une étape. */}
                  {index === 0 && state.undo ? (
                    <Pressable onPress={onUndoMove} hitSlop={8} accessibilityRole="button" className="active:opacity-60">
                      <Text className="text-xs font-semibold text-coral">{t('assistant.move.undo')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </>
      )}

      <View className="mt-4">
        <Button label={t('assistant.session.finish')} variant="ghost" onPress={onClose} />
      </View>
    </BottomSheetModal>
  );
}
