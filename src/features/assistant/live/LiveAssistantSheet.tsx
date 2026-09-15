import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../../components/BottomSheetModal';
import { Button } from '../../../components/Button';
import { Icon, type IconName } from '../../../components/Icon';
import { useScaled } from '../../../lib/textScale';
import { useThemeColors } from '../../../lib/theme';
import { useReducedMotion } from '../../../lib/useReducedMotion';
import { locationLabel } from '../resolve';
import type { LiveCard, LiveState, LiveStatus } from './useLiveAssistant';

// LA FEUILLE D'UNE CONVERSATION.
//
// Elle ne remplace pas la voix, elle la double : on range les mains prises,
// sans regarder. Ce qui s'y lit sert à VÉRIFIER — ce que Céoù a entendu, ce
// qu'il a répondu, ce qu'il a trouvé ou rangé. Tout le reste passe par la
// voix, comme avec n'importe quelle IA vocale : on lui coupe la parole en
// parlant. Un seul bouton, pour raccrocher.

const ACCENT = '#1591EA';

/**
 * La pastille qui dit ce que fait Céoù sans avoir à lire.
 *
 * Elle respire en écoutant, bat plus vite en parlant. Ce mouvement n'est qu'un
 * indice : l'état est aussi écrit juste à côté, et tout s'arrête si le
 * téléphone demande moins d'animations.
 */
function Orb({ status }: { status: LiveStatus }) {
  const reduced = useReducedMotion();
  const size = useScaled(72);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    if (reduced || (status !== 'listening' && status !== 'buffering' && status !== 'speaking')) return;
    const [peak, duration] = status === 'speaking' ? [1.14, 420] : [1.06, 1400];
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: peak, duration, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, scale, status]);

  const busy = status === 'connecting' || status === 'thinking';
  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size / 2, transform: [{ scale }] }}
      className="items-center justify-center bg-coral"
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="microphone" size={30} color="#FFFFFF" />}
    </Animated.View>
  );
}

function CardRow({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle?: string; onPress?: () => void }) {
  const colors = useThemeColors();
  const body = (
    <>
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-coral-light">
        <Icon name={icon} size={18} color={ACCENT} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-label font-semibold text-ink">{title}</Text>
        {subtitle ? <Text className="text-caption text-ink-soft">{subtitle}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron" size={18} color={colors.inkFaint} /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      className="mb-2 flex-row items-center gap-3 rounded-2xl bg-sand px-3 py-2 active:opacity-70"
    >
      {body}
    </Pressable>
  ) : (
    <View className="mb-2 flex-row items-center gap-3 rounded-2xl bg-sand px-3 py-2">{body}</View>
  );
}

function Card({ card, onOpen }: { card: LiveCard; onOpen: (path: Href) => void }) {
  const { t } = useTranslation();
  if (card.type === 'found') {
    return (
      <View>
        {card.entries.slice(0, 3).map((entry) => (
          <CardRow
            key={entry.id}
            icon="objet"
            title={entry.name}
            subtitle={locationLabel(entry)}
            onPress={() => onOpen(`/objet/${entry.id}`)}
          />
        ))}
      </View>
    );
  }
  if (card.type === 'moved') return <CardRow icon="validate" title={card.objetName} subtitle={card.destination} />;
  if (card.type === 'undone') return <CardRow icon="back" title={card.objetName} subtitle={card.location} />;
  if (card.type === 'place') {
    return <CardRow icon="piece" title={card.name} subtitle={t('assistant.live.place_count', { count: card.count })} />;
  }
  return <CardRow icon="pret" title={t('assistant.live.loans_count', { count: card.count })} onPress={() => onOpen('/prets')} />;
}

export function LiveAssistantSheet({ state, onStop, onInterrupt }: { state: LiveState; onStop: () => void; onInterrupt: () => void }) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const transcriptMaxHeight = useScaled(320);

  // Lignes et cartes partagent un même compteur : les trier sur lui rend
  // l'ordre réel de la conversation.
  const items = [
    ...state.lines.map((line) => ({ kind: 'line' as const, id: line.id, line })),
    ...state.cards.map((card) => ({ kind: 'card' as const, id: card.id, card })),
  ].sort((a, b) => a.id - b.id);

  const open = (path: Href) => {
    onStop();
    router.push(path);
  };

  return (
    <BottomSheetModal
      visible={state.active}
      onClose={onStop}
      sheetClassName="rounded-t-3xl bg-surface px-5 pb-4 pt-5"
      sheetStyle={{ maxHeight: '88%' }}
    >
      <View className="mb-4 flex-row items-center gap-4">
        <Orb status={state.status} />
        <View className="min-w-0 flex-1">
          <Text accessibilityRole="header" className="text-heading font-bold text-ink">
            {t('assistant.live.title')}
          </Text>
          {/* Annoncé à chaque changement : c'est ce qui dit, à qui ne voit pas
              la pastille, si Céoù écoute ou parle. */}
          <Text accessibilityLiveRegion="polite" className="text-label text-ink-soft">
            {t(`assistant.live.status_${state.status}`)}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ maxHeight: transcriptMaxHeight, flexShrink: 1 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {items.length === 0 ? (
          <Text className="mb-3 text-body leading-6 text-ink-soft">{t('assistant.live.example')}</Text>
        ) : (
          items.map((item) =>
            item.kind === 'card' ? (
              <Card key={`card-${item.id}`} card={item.card} onOpen={open} />
            ) : item.line.role === 'user' ? (
              <View key={`line-${item.id}`} className="mb-2 max-w-[85%] self-end rounded-2xl bg-coral-light px-3 py-2">
                <Text className="text-body text-ink">{item.line.text}</Text>
              </View>
            ) : (
              <Text key={`line-${item.id}`} className="mb-3 text-body leading-6 text-ink">
                {item.line.text}
              </Text>
            ),
          )
        )}
      </ScrollView>

      <View className="mt-4">
        {state.status === 'speaking' ? (
          <View className="mb-3">
            <Button label={t('assistant.live.interrupt')} onPress={onInterrupt} />
          </View>
        ) : null}
        <Button label={t('assistant.session.finish')} variant="outline" onPress={onStop} />
      </View>
    </BottomSheetModal>
  );
}
