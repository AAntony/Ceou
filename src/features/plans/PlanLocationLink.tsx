import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { usePieceLocationOnPlan } from './queries';
import { useThemeColors } from '../../lib/theme';

type PlanLocationLinkProps = {
  pieceId?: string;
  emplacementId?: string;
  /**
   * Montre où appuyer : une phrase au-dessus, un cadre appuyé, et quelques
   * battements pour attirer l'œil.
   *
   * Posé uniquement par le GUIDE DE DÉMARRAGE, qui vient de dessiner le plan
   * et dépose la personne sur la fiche de son objet. Sans ça, la dernière
   * étape du guide serait « trouve un bouton dont tu ignores l'existence » —
   * or c'est justement ce bouton qui referme le cycle qu'il enseigne.
   * L'emphase s'éteint d'elle-même après quelques battements : elle indique,
   * elle ne clignote pas indéfiniment.
   */
  emphasis?: boolean;
};

const PULSE_COUNT = 4;
const PULSE_MS = 700;

// Rendu vide si la pièce de l'objet n'a jamais été placée sur un plan —
// pas de bouton mort pour une fonctionnalité (Plans) que l'utilisateur n'a
// peut-être pas encore utilisée.
export function PlanLocationLink({ pieceId, emplacementId, emphasis }: PlanLocationLinkProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { data } = usePieceLocationOnPlan(pieceId ?? '');

  // Déclarés AVANT toute sortie anticipée : le rendu vide ci-dessous ne doit
  // pas changer le nombre de hooks appelés d'un rendu à l'autre.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!emphasis) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: PULSE_MS, useNativeDriver: true }),
      ]),
      { iterations: PULSE_COUNT },
    );
    loop.start();
    return () => loop.stop();
  }, [emphasis, pulse]);

  if (!pieceId || !data) return null;

  return (
    <View className="mb-6">
      {emphasis ? (
        <Text className="mb-2 text-center text-label font-semibold text-coral-dark">
          {t('inventory.objet.view_on_plan_hint')}
        </Text>
      ) : null}

      {/* Rien en `className` sur la vue animée : les classes utilitaires s'y
          perdent (constaté sur la barre de progression du guide). Elle ne
          porte donc que la transformation, et l'apparence reste sur le
          bouton lui-même. */}
      <Animated.View
        style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push(
              `/plan/${data.planId}?highlightFormeId=${data.formeId}${emplacementId ? `&highlightEmplacementId=${emplacementId}` : ''}`,
            )
          }
          className={`flex-row items-center justify-center gap-2 rounded-xl bg-coral-light px-4 py-3 active:opacity-70 ${
            emphasis ? 'border-2 border-coral' : 'border border-coral/30'
          }`}
        >
          <Icon name="plan" size={18} color={colors.accentDark} />
          <Text className="shrink text-label font-semibold text-coral-dark">{t('inventory.objet.view_on_plan')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
