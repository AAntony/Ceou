import { Pressable, Text, View } from 'react-native';
import { floorLabel } from './floorLabel';
import type { Plan } from '../../types/database';

// LE SÉLECTEUR DE NIVEAU, posé sur le plan.
//
// Une habitation peut avoir plusieurs plans — un par étage. Jusqu'ici il
// fallait ressortir vers la liste pour passer du rez-de-chaussée à l'étage,
// c'est-à-dire quitter ce qu'on regardait pour y revenir autrement. La
// colonne de boutons rend le passage immédiat, comme les niveaux d'une carte
// de jeu ou les touches d'un ascenseur.
//
// L'ORDRE EST CELUI DE LA LISTE DES PLANS, de haut en bas, sans
// réinterprétation : ce que la personne a rangé là se retrouve ici. C'est
// aussi pour ça que la liste a gagné ses flèches de déplacement — sans elles,
// l'ordre aurait été celui des créations, que personne n'a choisi.
//
// Chaque bouton porte une ABRÉVIATION (voir floorLabel) parce qu'une colonne
// étroite ne peut pas afficher « Rez-de-chaussée » sans manger le plan. Le
// nom complet n'est pas perdu pour autant : il reste le titre de l'écran, et
// c'est lui qu'annonce le lecteur d'écran.
//
// Rien ne s'affiche en dessous de deux plans : un sélecteur à un seul cran ne
// propose rien.

type PlanFloorSwitchProps = {
  plans: Plan[];
  currentId: string;
  onSelect: (planId: string) => void;
};

export function PlanFloorSwitch({ plans, currentId, onSelect }: PlanFloorSwitchProps) {
  if (plans.length < 2) return null;

  return (
    // `self-end` : la colonne se cale à droite sans prendre la largeur, et
    // laisse le reste du plan libre au doigt.
    <View className="self-end overflow-hidden rounded-2xl border border-ink/10 bg-surface/95">
      {plans.map((plan, index) => {
        const active = plan.id === currentId;
        return (
          <Pressable
            key={plan.id}
            onPress={() => onSelect(plan.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            // Le nom ENTIER, pas l'abréviation : « RDC » lu à voix haute ne
            // veut rien dire, « Rez-de-chaussée » si.
            accessibilityLabel={plan.name}
            className={`min-w-[2.75rem] items-center justify-center px-2 py-2.5 ${
              index > 0 ? 'border-t border-ink/10' : ''
            } ${active ? 'bg-coral' : 'active:opacity-60'}`}
          >
            <Text
              numberOfLines={1}
              className={`text-label font-bold ${active ? 'text-white' : 'text-ink-soft'}`}
            >
              {floorLabel(plan.name)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
