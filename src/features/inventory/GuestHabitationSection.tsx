import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { EntityCard } from '../../components/EntityCard';
import { EntityGrid } from '../../components/EntityGrid';
import { EntityRow } from '../../components/EntityRow';
import { usePlans } from '../plans/queries';
import { HUE_BADGE_FILL, HUE_CARD_BG_HEX } from '../search/palette';
import type { Habitation } from '../../types/database';
import { getHabitationIcon } from './constants';

// Vue d'un visiteur sur une habitation partagée : l'habitation, immédiatement
// suivie de ses plans.
//
// POURQUOI UN COMPOSANT SÉPARÉ : chaque habitation a besoin de son propre
// usePlans(), et un hook ne peut pas être appelé dans une boucle — il faut
// donc un composant par ligne.
//
// POURQUOI UNE VUE À PART : l'écran Habitations normal ne montre rien à un
// visiteur. Son onglet « Personnelles » filtre sur `user_id === moi` (un
// visiteur ne possède rien) et son onglet « Partagées » liste des AMIS (un
// visiteur n'en a pas). Il se retrouvait donc devant deux onglets vides alors
// même que la RLS lui donne bien accès à l'habitation de son hôte.
export function GuestHabitationSection({ habitation }: { habitation: Habitation }) {
  const { t } = useTranslation();
  const { data: plans } = usePlans(habitation.id);

  return (
    <View className="mb-6">
      <EntityRow
        level="habitation"
        icon={getHabitationIcon(habitation.type)}
        title={habitation.name}
        subtitle={t(`inventory.habitationTypes.${habitation.type}`)}
        photoUri={habitation.photo_url}
        onPress={() => router.push(`/habitation/${habitation.id}`)}
      />

      {/* Les plans sont remontés au premier niveau plutôt que laissés derrière
          un onglet de l'écran Habitation : pour un visiteur qui cherche où se
          trouve une pièce, le plan EST la porte d'entrée, pas une vue
          secondaire. */}
      {(plans ?? []).length > 0 ? (
        <View className="mt-2">
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">{t('plans.section_label')}</Text>
          <EntityGrid>
            {(plans ?? []).map((plan) => (
              <EntityCard
                key={plan.id}
                icon="plan"
                title={plan.name}
                bgColor={HUE_CARD_BG_HEX.lavender}
                badgeColor={HUE_BADGE_FILL.lavender}
                onPress={() => router.push(`/plan/${plan.id}`)}
              />
            ))}
          </EntityGrid>
        </View>
      ) : null}
    </View>
  );
}
