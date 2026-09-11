import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { TextField } from '../../components/TextField';
import { useMediaSource } from '../../lib/images/media';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { PLACEHOLDER_IMAGES } from '../inventory/placeholders';
import { useSearchIndex, type SearchIndexEntry } from '../search/queries';

// CHOISIR LES OBJETS QU'UN TICKET COUVRE.
//
// ═══ POURQUOI L'INDEX DE RECHERCHE, ET PAS L'ARBORESCENCE ═══
//
// On sort d'un magasin avec quatre chaises et un seul ticket. On sait comment
// s'appellent les chaises ; on ne veut pas redescendre Habitation > Pièce >
// Emplacement quatre fois pour les retrouver. `search_index` rend tout
// l'inventaire en une requête déjà mise en cache par l'accueil, avec le nom,
// la photo et l'endroit — de quoi chercher au nom et distinguer deux objets
// homonymes par leur emplacement.
//
// PLUSIEURS D'AFFILÉE SANS REFERMER : le geste naturel est « celle-ci,
// celle-ci, et celle-là ». La feuille reste ouverte, les choix s'accumulent,
// et c'est « Ajouter » qui referme. Refermer à chaque choix obligerait à la
// rouvrir trois fois.
//
// MODALE VOISINE DE LA FEUILLE, PAS ENFANT : deux modales imbriquées se
// disputent la présentation sur iOS. Même montage que la visionneuse.

type ObjetPickerModalProps = {
  visible: boolean;
  /** Ceux déjà sur la facture : ils ne se proposent pas deux fois. */
  dejaChoisis: string[];
  onClose: () => void;
  onValider: (objets: { objetId: string; name: string }[]) => void;
};

export function ObjetPickerModal({ visible, dejaChoisis, onClose, onValider }: ObjetPickerModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { data } = useSearchIndex();

  const [recherche, setRecherche] = useState('');
  const [choisis, setChoisis] = useState<Map<string, string>>(new Map());

  const objets = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return (data ?? [])
      .filter((entree) => entree.kind === 'objet' && !dejaChoisis.includes(entree.id))
      .filter((entree) => (terme ? entree.name.toLowerCase().includes(terme) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, dejaChoisis, recherche]);

  const basculer = useCallback((entree: SearchIndexEntry) => {
    setChoisis((actuels) => {
      const suivants = new Map(actuels);
      if (suivants.has(entree.id)) suivants.delete(entree.id);
      else suivants.set(entree.id, entree.name);
      return suivants;
    });
  }, []);

  const fermer = () => {
    setChoisis(new Map());
    setRecherche('');
    onClose();
  };

  const valider = () => {
    onValider([...choisis].map(([objetId, name]) => ({ objetId, name })));
    setChoisis(new Map());
    setRecherche('');
  };

  const renderItem = useCallback(
    ({ item }: { item: SearchIndexEntry }) => (
      <Rangee entree={item} choisi={choisis.has(item.id)} onPress={() => basculer(item)} />
    ),
    [choisis, basculer],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={fermer} statusBarTranslucent>
      <View className="flex-1 bg-sand" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-2 px-4 pb-1 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={fermer}
            hitSlop={10}
            className="p-2 active:opacity-60"
          >
            <Icon name="close" size={22} color={colors.ink} />
          </Pressable>
          <Text className="flex-1 text-subheading font-bold text-ink">{t('factures.objets.title')}</Text>
        </View>

        <View className="px-6">
          <TextField
            label={t('factures.objets.search')}
            value={recherche}
            onChangeText={setRecherche}
            autoFocus
          />
        </View>

        <FlatList
          className="flex-1"
          data={objets}
          keyExtractor={(entree) => entree.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-label text-ink-soft">{t('factures.objets.empty')}</Text>
          }
        />

        <View
          className="border-t border-ink/10 bg-surface px-6 pt-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: choisis.size === 0 }}
            onPress={valider}
            disabled={choisis.size === 0}
            className={`items-center rounded-xl px-4 py-3 ${choisis.size === 0 ? 'bg-ink/10' : 'bg-coral active:opacity-80'}`}
          >
            <Text className={choisis.size === 0 ? 'font-semibold text-ink-faint' : 'font-semibold text-white'}>
              {t('factures.objets.add', { count: choisis.size })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Rangee({
  entree,
  choisi,
  onPress,
}: {
  entree: SearchIndexEntry;
  choisi: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const photo = useMediaSource(entree.photo_url);
  const largeur = useScaled(48);
  const hauteur = useScaled(36);
  const taille = useScaled(22);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: choisi }}
      accessibilityLabel={entree.name}
      onPress={onPress}
      className="mb-2 flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3 active:opacity-70"
    >
      <View
        style={{ width: taille, height: taille }}
        className={`items-center justify-center rounded-md border-2 ${choisi ? 'border-coral bg-coral' : 'border-ink/25'}`}
      >
        {choisi ? <Icon name="validate" size={14} color="#FFFFFF" /> : null}
      </View>

      <View style={{ width: largeur, height: hauteur }} className="overflow-hidden rounded-lg bg-sand">
        <Image
          source={photo ?? PLACEHOLDER_IMAGES.objet}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      </View>

      {/* DEUX LIGNES, TOUJOURS : le nom, puis l'endroit. C'est l'endroit qui
          départage deux objets qui portent le même nom, et il y en a
          toujours — « Lampe » existe en trois exemplaires chez tout le
          monde. */}
      <View className="flex-1">
        <Text numberOfLines={1} className="text-body text-ink">
          {entree.name}
        </Text>
        <Text numberOfLines={1} className="text-caption text-ink-soft">
          {[entree.piece_name, entree.parent_label].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <Icon name="objet" size={16} color={colors.inkFaint} />
    </Pressable>
  );
}
