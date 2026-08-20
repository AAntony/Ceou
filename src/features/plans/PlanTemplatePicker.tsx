import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { logClientError } from '../../lib/errorLogging';
import { useApplyPlanTemplate } from './queries';
import { PLAN_TEMPLATES, TEMPLATE_BLOCK, templateRoomsForWorld, type PlanTemplate } from './templates';

// État vide d'un plan : on propose des logements types au lieu d'une feuille
// blanche.
//
// C'est l'insertion la plus économe : aucun changement au parcours de
// création (un plan naît toujours d'un simple nom), et les plans déjà vides
// en profitent aussi. Un plan qui a déjà des formes ne voit jamais cet écran.

const PREVIEW_WIDTH = 132;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * TEMPLATE_BLOCK.height) / TEMPLATE_BLOCK.width);

// Aperçu dessiné en View, pas en SVG : react-native-svg est absent du projet
// (voir IconBadge). Chaque pièce est une View bordée — la même technique que
// le canvas lui-même, à l'échelle près.
function TemplatePreview({ template, active }: { template: PlanTemplate; active: boolean }) {
  const scale = PREVIEW_WIDTH / TEMPLATE_BLOCK.width;

  return (
    <View
      style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, backgroundColor: '#FFFFFF' }}
      className="overflow-hidden rounded-lg"
    >
      {template.rooms.map((room, index) => (
        <View
          key={`${template.id}-${index}`}
          style={{
            position: 'absolute',
            left: room.x * scale,
            top: room.y * scale,
            width: room.width * scale,
            height: room.height * scale,
            borderWidth: 1.5,
            borderColor: active ? '#0B5E9E' : '#2D2A26',
          }}
        />
      ))}
    </View>
  );
}

export function PlanTemplatePicker({ planId }: { planId: string }) {
  const { t } = useTranslation();
  const applyTemplate = useApplyPlanTemplate(planId);
  const [selectedId, setSelectedId] = useState<string>(PLAN_TEMPLATES[0].id);

  const selected = PLAN_TEMPLATES.find((template) => template.id === selectedId) ?? PLAN_TEMPLATES[0];

  const handleApply = async () => {
    try {
      await applyTemplate.mutateAsync(templateRoomsForWorld(selected));
    } catch (error) {
      logClientError(error, { source: 'apply_plan_template', template: selected.id });
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-6 pb-8 pt-2" keyboardShouldPersistTaps="handled">
      <Text className="text-2xl font-bold leading-8 text-ink">{t('plans.templates.title')}</Text>
      <Text className="mt-2 text-base leading-6 text-ink-soft">{t('plans.templates.description')}</Text>

      <View className="mt-5 flex-row flex-wrap justify-between">
        {PLAN_TEMPLATES.map((template) => {
          const active = template.id === selectedId;
          return (
            <Pressable
              key={template.id}
              onPress={() => setSelectedId(template.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`mb-3 rounded-2xl p-3 active:opacity-80 ${
                active ? 'border-2 border-coral bg-coral-light' : 'border border-ink/10 bg-white'
              }`}
              style={{ width: '48%' }}
            >
              <TemplatePreview template={template} active={active} />
              <Text className={`mt-2.5 text-base font-semibold ${active ? 'text-coral-dark' : 'text-ink'}`}>
                {t(template.labelKey)}
              </Text>
              <Text className={`text-xs ${active ? 'text-coral-dark' : 'text-ink-soft'}`}>
                {t('plans.templates.room_count', { n: template.rooms.length })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-2">
        <Button label={t('plans.templates.apply')} onPress={handleApply} loading={applyTemplate.isPending} />
      </View>

      {/* Les pièces manquantes sont créées dans l'habitation, celles qui
          existent déjà sont réutilisées — le dire évite de croire qu'on va
          se retrouver avec deux « Cuisine ». */}
      <Text className="mt-3 text-center text-xs leading-4 text-ink-soft">{t('plans.templates.note')}</Text>

      {applyTemplate.isPending ? (
        <View className="mt-4 items-center">
          <ActivityIndicator />
        </View>
      ) : null}
    </ScrollView>
  );
}
