import { Fragment } from 'react';
import { Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import { Pop } from './Pop';

// LE FIL QUI GRANDIT — la pièce maîtresse du guide.
//
// Le problème à résoudre n'est pas « comment ajouter un objet », c'est
// « pourquoi faut-il d'abord une habitation, puis une pièce, puis un
// rangement ». Une phrase l'explique mal ; ce fil le MONTRE, parce qu'il se
// construit sous les yeux de la personne au fur et à mesure qu'elle répond.
// À la dernière étape, elle a sous les yeux le chemin complet de son objet —
// c'est-à-dire la réponse exacte que l'app lui donnera le jour où elle le
// cherchera.
//
// C'est aussi pour ça que chaque maillon a SA couleur, tenue d'un bout à
// l'autre du guide (la même pastille se retrouve sur les cartes de choix) :
// on doit reconnaître un niveau à sa teinte avant de lire son nom.

export type GuideLevel = 'habitation' | 'piece' | 'emplacement' | 'conteneur' | 'objet';

const CHIP_CLASS: Record<GuideLevel, string> = {
  habitation: 'bg-coral-light',
  piece: 'bg-teal-light',
  emplacement: 'bg-mustard-light',
  conteneur: 'bg-sky-light',
  objet: 'bg-coral-light',
};

const TEXT_CLASS: Record<GuideLevel, string> = {
  habitation: 'text-coral-dark',
  piece: 'text-teal-dark',
  emplacement: 'text-mustard-dark',
  conteneur: 'text-sky-dark',
  objet: 'text-coral-dark',
};

/** La teinte d'icône du niveau — une icône vectorielle veut une valeur, pas une classe. */
export function useLevelColor(): (level: GuideLevel) => string {
  const colors = useThemeColors();
  return (level) =>
    level === 'piece'
      ? colors.tealDark
      : level === 'emplacement'
        ? colors.mustardDark
        : level === 'conteneur'
          ? colors.skyDark
          : colors.accentDark;
}

export function levelChipClass(level: GuideLevel): string {
  return CHIP_CLASS[level];
}

export type RailItem = {
  level: GuideLevel;
  icon: IconName;
  label: string;
};

export function PathRail({ items }: { items: RailItem[] }) {
  const colors = useThemeColors();
  const levelColor = useLevelColor();

  if (items.length === 0) return null;

  return (
    // `flex-wrap` : le fil peut compter cinq maillons, et chaque maillon
    // grandit avec le réglage de taille du texte. Sur une seule ligne, la fin
    // du chemin — c'est-à-dire l'objet — serait la première chose à sortir de
    // l'écran.
    <View className="flex-row flex-wrap items-center gap-1.5">
      {items.map((item, index) => (
        <Fragment key={`${item.level}-${item.label}`}>
          {index > 0 ? <Icon name="chevron" size={14} color={colors.inkFaint} /> : null}
          <Pop>
            <View className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${CHIP_CLASS[item.level]}`}>
              <Icon name={item.icon} size={14} color={levelColor(item.level)} />
              <Text className={`text-caption font-semibold ${TEXT_CLASS[item.level]}`}>{item.label}</Text>
            </View>
          </Pop>
        </Fragment>
      ))}
    </View>
  );
}
