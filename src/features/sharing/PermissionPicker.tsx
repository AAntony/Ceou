import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { STACK_SCALE, useTextScale } from '../../lib/textScale';
import type { HabitationPermission } from '../../types/database';

type PermissionPickerProps = {
  value: HabitationPermission | null;
  onChange: (value: HabitationPermission | null) => void;
};

const OPTIONS: { value: HabitationPermission | null; labelKey: string }[] = [
  { value: null, labelKey: 'friends.permission.none' },
  { value: 'consultation', labelKey: 'friends.permission.consultation' },
  { value: 'modification', labelKey: 'friends.permission.modification' },
  { value: 'proprietaire', labelKey: 'friends.permission.proprietaire' },
];

// Réutilisé partout où un droit d'accès Habitation se choisit — même
// vocabulaire de droits partout (voir modèle de droits du plan Phase 8).
export function PermissionPicker({ value, onChange }: PermissionPickerProps) {
  const { t } = useTranslation();
  const { textScale } = useTextScale();

  // EN GRAND TEXTE, LES QUATRE DROITS DEVIENNENT UNE LISTE.
  //
  // « Consultation », « Modification », « Propriétaire » sont des mots longs
  // dans des pastilles qui s'enroulent : à x1,3 chacune occupe déjà presque
  // toute la largeur, et l'enroulement produit une colonne bancale — une
  // pastille par ligne, décalées et de largeurs différentes. Autant l'assumer
  // en vraie liste : une ligne par droit, pleine largeur, avec une coche, ce
  // qui rend au passage le droit actif lisible autrement que par la couleur.
  const stacked = textScale >= STACK_SCALE;

  // Un seul droit à la fois : le rôle radio fait annoncer « 2 sur 4 » au
  // lecteur d'écran, là où quatre boutons ne disaient ni le nombre ni lequel
  // était retenu.
  return (
    <View accessibilityRole="radiogroup" className={stacked ? 'gap-2' : 'flex-row flex-wrap gap-2'}>
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            key={opt.labelKey}
            onPress={() => onChange(opt.value)}
            className={`border ${
              stacked ? 'flex-row items-center justify-between gap-3 rounded-xl px-4 py-3' : 'rounded-full px-3 py-1.5'
            } ${active ? 'border-coral bg-coral' : 'border-ink/10 bg-surface'}`}
          >
            <Text
              className={`${stacked ? 'flex-1 text-body' : 'text-label'} font-medium ${
                active ? 'text-white' : 'text-ink-soft'
              }`}
            >
              {t(opt.labelKey)}
            </Text>
            {stacked && active ? <Icon name="validate" size={20} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
