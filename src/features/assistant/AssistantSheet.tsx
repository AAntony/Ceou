import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { getEmplacementIcon } from '../inventory/constants';
import type { MoveDestination } from './move';
import { locationLabel } from './resolve';
import { isSpeechAvailable, speak } from './speak';
import { draftSelection, type AssistantState } from './useAssistant';
import { useThemeColors } from '../../lib/theme';

// Réponse de l'assistant vocal.
//
// La réponse en toutes lettres passe AVANT la liste : à « où sont mes clés »,
// on répond « dans l'Entrée, meuble d'entrée », pas par une grille de cartes à
// déchiffrer. La liste vient ensuite, pour agir.
//
// Le RANGEMENT ajoute un temps à ce dialogue : quand la dictée laisse un
// doute, le même écran sert à trancher ET à confirmer. Rien ne s'écrit avant
// l'appui sur « Ranger ».

const ACCENT = '#1591EA';

/** Un meuble porte l'icône de son type, une boîte celle des conteneurs. */
function destinationIcon(destination: MoveDestination): IconName {
  return destination.type === 'conteneur' ? 'conteneur' : getEmplacementIcon(destination.presetKey);
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
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
  onConfirmMove,
  onUndoMove,
}: {
  state: AssistantState;
  onClose: () => void;
  onChooseObjet: (objetId: string | null) => void;
  onChooseDestination: (destinationId: string | null) => void;
  onConfirmMove: () => void;
  onUndoMove: () => void;
}) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();

  const visible =
    state.status === 'thinking' ||
    state.status === 'answered' ||
    state.status === 'error' ||
    state.status === 'move' ||
    state.status === 'moving' ||
    state.status === 'moved';

  const entries = state.result?.entries ?? [];
  const draft = state.move;
  const selection = draft ? draftSelection(draft) : null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-surface px-5 pb-4 pt-5"
      sheetStyle={{ maxHeight: '85%' }}
    >
      {/* Ce que l'app a compris, affiché tel quel : c'est la seule façon pour
          l'utilisateur de comprendre une réponse à côté de la plaque — la
          dictée a pu entendre autre chose que ce qu'il a dit. */}
      {state.transcript ? (
        <View className="mb-4 flex-row items-start gap-2">
          <Icon name="microphone" size={16} color={colors.inkFaint} />
          <Text className="flex-1 text-sm italic leading-5 text-ink-soft">« {state.transcript} »</Text>
        </View>
      ) : null}

      {state.status === 'thinking' ? (
        <View className="items-center py-6">
          <ActivityIndicator />
          <Text className="mt-3 text-sm text-ink-soft">{t('assistant.thinking')}</Text>
        </View>
      ) : null}

      {state.status === 'moving' ? (
        <View className="items-center py-6">
          <ActivityIndicator />
          <Text className="mt-3 text-sm text-ink-soft">{t('assistant.move.moving')}</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View className="py-2">
          <Text className="text-base leading-6 text-ink">{t(`assistant.${state.errorKey}`)}</Text>
        </View>
      ) : null}

      {/* === Rangement : choisir, puis confirmer ============================ */}
      {state.status === 'move' && draft ? (
        <>
          {!draft.objetId ? (
            <>
              <Text className="mb-2 text-lg font-semibold leading-7 text-ink">
                {t('assistant.move.which_object', { n: draft.objets.length })}
              </Text>
              <ScrollView style={{ maxHeight: 300, flexShrink: 1 }}>
                {draft.objets.map((objet) => (
                  <Row
                    key={objet.id}
                    icon="objet"
                    title={objet.name}
                    subtitle={locationLabel(objet)}
                    onPress={() => onChooseObjet(objet.id)}
                  />
                ))}
              </ScrollView>
            </>
          ) : !draft.destinationId ? (
            <>
              <Text className="mb-2 text-lg font-semibold leading-7 text-ink">
                {t('assistant.move.which_destination', { n: draft.destinations.length })}
              </Text>
              <ScrollView style={{ maxHeight: 300, flexShrink: 1 }}>
                {draft.destinations.map((destination) => (
                  <Row
                    key={destination.id}
                    icon={destinationIcon(destination)}
                    title={destination.name}
                    subtitle={destination.label}
                    onPress={() => onChooseDestination(destination.id)}
                  />
                ))}
              </ScrollView>
            </>
          ) : selection ? (
            <>
              <Text className="mb-3 text-lg font-semibold leading-7 text-ink">
                {t('assistant.move.confirm_title')}
              </Text>

              <View className="rounded-2xl border border-ink/10 p-4">
                <MovePart
                  label={t('assistant.move.what')}
                  name={selection.objet.name}
                  detail={t('assistant.move.from', { location: locationLabel(selection.objet) })}
                  changeable={draft.objets.length > 1}
                  onChange={() => onChooseObjet(null)}
                  changeLabel={t('assistant.move.change')}
                />
                <View className="my-3 h-px bg-ink/10" />
                <MovePart
                  label={t('assistant.move.where')}
                  name={selection.destination.name}
                  detail={selection.destination.label}
                  changeable={draft.destinations.length > 1}
                  onChange={() => onChooseDestination(null)}
                  changeLabel={t('assistant.move.change')}
                />
              </View>

              <View className="mt-4">
                <Button label={t('assistant.move.confirm')} onPress={onConfirmMove} />
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {/* === Réponse ordinaire, et fin d'un rangement ======================= */}
      {state.status === 'answered' || state.status === 'moved' ? (
        <>
          <View className="mb-4 flex-row items-start gap-3">
            <Text className="flex-1 text-lg font-semibold leading-7 text-ink">{state.answer}</Text>
            {/* Réécouter : sans valeur si l'appareil ne peut pas parler (build
                sans le module natif), donc masqué dans ce cas plutôt
                qu'affiché et inerte. */}
            {isSpeechAvailable() ? (
              <Pressable
                onPress={() => void speak(state.answer, i18n.language)}
                accessibilityRole="button"
                accessibilityLabel={t('assistant.replay')}
                className="h-11 w-11 items-center justify-center rounded-full border border-ink/10 active:opacity-70"
              >
                <Icon name="microphone" size={18} color={ACCENT} />
              </Pressable>
            ) : null}
          </View>

          {/* Après un rangement, l'objet rangé reste à portée : c'est le seul
              endroit où vérifier, et sa fiche porte l'historique. */}
          {state.status === 'moved' && selection ? (
            <Row
              icon="objet"
              title={selection.objet.name}
              subtitle={selection.destination.label}
              onPress={() => {
                onClose();
                router.push(`/objet/${selection.objet.id}`);
              }}
            />
          ) : null}

          {/* Le rangement s'écrit sans confirmation quand la dictée est nette.
              Ce bouton est donc le filet — il doit se voir tout de suite, pas
              se chercher. */}
          {state.status === 'moved' && state.undo ? (
            <View className="mt-4">
              <Button label={t('assistant.move.undo')} variant="outline" onPress={onUndoMove} />
            </View>
          ) : null}

          {state.status === 'answered' && entries.length > 0 ? (
            <ScrollView style={{ maxHeight: 320, flexShrink: 1 }}>
              {entries.map((entry) => (
                <Row
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
        </>
      ) : null}

      <View className="mt-4">
        <Button
          label={state.status === 'move' ? t('common.cancel') : t('common.close')}
          variant="ghost"
          onPress={onClose}
        />
      </View>
    </BottomSheetModal>
  );
}

/** Une moitié de la confirmation : ce qu'on range, ou l'endroit où on le range. */
function MovePart({
  label,
  name,
  detail,
  changeable,
  onChange,
  changeLabel,
}: {
  label: string;
  name: string;
  detail: string | null;
  changeable: boolean;
  onChange: () => void;
  changeLabel: string;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="flex-1">
        <Text className="text-xs uppercase tracking-wide text-ink-faint">{label}</Text>
        <Text className="mt-0.5 text-base font-semibold text-ink">{name}</Text>
        {detail ? <Text className="text-xs text-ink-soft">{detail}</Text> : null}
      </View>
      {changeable ? (
        <Pressable onPress={onChange} accessibilityRole="button" className="py-1 active:opacity-70">
          <Text className="text-sm font-semibold text-coral">{changeLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
