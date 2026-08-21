import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';

// Rangée d'ami.
//
// Même structure que les rangées d'inventaire (vignette, nom, information
// utile, chevron) mais avec un AVATAR ROND, et c'est un écart assumé : un
// visage dans un cadre 4:3 ne se lit pas comme une personne. Le cercle est
// la convention partout, au point qu'une photo de profil carrée passe pour
// une erreur d'affichage.
//
// D'où un composant à part plutôt qu'une option de plus sur EntityRow :
// EntityRow est bâtie autour d'un niveau d'inventaire et de son illustration
// par défaut, deux notions qui n'ont aucun sens pour une personne.

const AVATAR_SIZE = 42;

// Teinte de repli déterministe sur l'identifiant : le même ami garde la même
// couleur d'une session à l'autre, et deux amis voisins dans la liste en ont
// statistiquement des différentes.
const AVATAR_COLORS = ['#2EC4B6', '#8B7BD8', '#FFC857', '#D85A30', '#1591EA', '#7BB661'];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Deux lettres au plus : « Agathe Moreau » -> AM, « Agathe » -> AG. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

type FriendRowProps = {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
  onPress: () => void;
};

export function FriendRow({ id, name, subtitle, avatarUrl, onPress }: FriendRowProps) {
  const color = avatarColor(id);

  return (
    <Pressable
      onPress={onPress}
      className="mb-2 flex-row items-center rounded-2xl bg-white p-2.5 active:opacity-70"
    >
      <View
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: color }}
        className="items-center justify-center overflow-hidden"
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          // Les initiales plutôt qu'une silhouette générique : elles
          // distinguent réellement deux amis sans photo, ce qu'un même
          // pictogramme répété ne fait pas.
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{initials(name)}</Text>
        )}
      </View>

      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-ink">
          {name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="mt-0.5 text-sm text-ink-soft">
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Icon name="chevron" size={22} color="#C4BDB1" />
    </Pressable>
  );
}
