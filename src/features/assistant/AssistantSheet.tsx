import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { locationLabel } from './resolve';
import { isSpeechAvailable, speak } from './speak';
import type { AssistantState } from './useAssistant';

// Réponse de l'assistant vocal.
//
// La réponse en toutes lettres passe AVANT la liste : à « où sont mes clés »,
// on répond « dans l'Entrée, meuble d'entrée », pas par une grille de cartes à
// déchiffrer. La liste vient ensuite, pour agir.

export function AssistantSheet({
  state,
  onClose,
}: {
  state: AssistantState;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();

  const visible = state.status === 'thinking' || state.status === 'answered' || state.status === 'error';
  const entries = state.result?.entries ?? [];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-white px-5 pb-4 pt-5"
      sheetStyle={{ maxHeight: '85%' }}
    >
      {/* Ce que l'app a compris, affiché tel quel : c'est la seule façon pour
          l'utilisateur de comprendre une réponse à côté de la plaque — la
          dictée a pu entendre autre chose que ce qu'il a dit. */}
      {state.transcript ? (
        <View className="mb-4 flex-row items-start gap-2">
          <Icon name="microphone" size={16} color="#A39C8F" />
          <Text className="flex-1 text-sm italic leading-5 text-ink-soft">« {state.transcript} »</Text>
        </View>
      ) : null}

      {state.status === 'thinking' ? (
        <View className="items-center py-6">
          <ActivityIndicator />
          <Text className="mt-3 text-sm text-ink-soft">{t('assistant.thinking')}</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View className="py-2">
          <Text className="text-base leading-6 text-ink">{t(`assistant.${state.errorKey}`)}</Text>
        </View>
      ) : null}

      {state.status === 'answered' ? (
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
                <Icon name="microphone" size={18} color="#1591EA" />
              </Pressable>
            ) : null}
          </View>

          {entries.length > 0 ? (
            <ScrollView style={{ maxHeight: 320, flexShrink: 1 }}>
              {entries.map((entry) => (
                <Pressable
                  key={entry.id}
                  onPress={() => {
                    onClose();
                    router.push(`/objet/${entry.id}`);
                  }}
                  className="flex-row items-center gap-3 border-b border-ink/5 py-3 active:opacity-70"
                >
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-coral-light">
                    <Icon name="objet" size={18} color="#1591EA" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base text-ink" numberOfLines={1}>
                      {entry.name}
                    </Text>
                    <Text className="text-xs text-ink-soft" numberOfLines={1}>
                      {locationLabel(entry)}
                    </Text>
                  </View>
                  <Icon name="chevron" size={18} color="#A39C8F" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}

      <View className="mt-4">
        <Button label={t('common.close')} variant="ghost" onPress={onClose} />
      </View>
    </BottomSheetModal>
  );
}
