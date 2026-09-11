import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { TextField } from '../../components/TextField';
import { useMediaSource } from '../../lib/images/media';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { dateOrderFor, fromIsoDate } from './dateField';
import { useAttachFactureToObjet, useFacturesARattacher } from './queries';

// RATTACHER UN OBJET À UNE FACTURE DÉJÀ ENREGISTRÉE.
//
// LE GESTE DU TICKET DE CAISSE : quatre chaises, un seul document. On a
// photographié le ticket en ajoutant la première, et les trois autres n'ont
// pas à le refaire — c'est le même papier, c'est la même ligne de comptes.
//
// VU DEPUIS L'OBJET, et c'est ce qui le distingue de « ajouter un objet à
// cette facture » : ici on tient l'objet et on cherche son ticket. L'autre
// sens — tenir le ticket et lui ajouter des objets — se fait depuis le
// dossier du logement, parce que c'est là que vit le ticket.
//
// LES PLUS RÉCENTES D'ABORD : un rattachement suit presque toujours une
// saisie de la minute précédente. La recherche n'est là que pour le cas
// d'après — retrouver le ticket d'un meuble acheté l'an dernier pour y
// ajouter la table assortie.
//
// MODALE VOISINE DE LA FEUILLE, PAS ENFANT : deux modales imbriquées se
// disputent la présentation sur iOS.

type RattacherFactureModalProps = {
  visible: boolean;
  objetId: string;
  onClose: () => void;
};

export function RattacherFactureModal({ visible, objetId, onClose }: RattacherFactureModalProps) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const rattacher = useAttachFactureToObjet();
  const [recherche, setRecherche] = useState('');

  // `visible` en garde : la requête ne part pas tant que la feuille est
  // fermée. Elle vit sur des écrans qu'on ouvre bien plus souvent qu'on ne
  // rattache une facture.
  const { data, isLoading } = useFacturesARattacher(objetId, visible);

  const factures = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return data ?? [];
    return (data ?? []).filter((facture) =>
      [facture.vendor ?? '', ...(facture.objet_names ?? [])].some((texte) => texte.toLowerCase().includes(terme)),
    );
  }, [data, recherche]);

  const fermer = () => {
    setRecherche('');
    onClose();
  };

  const choisir = useCallback(
    (facture: { id: string; vendor: string | null }) => {
      rattacher.mutate({ factureId: facture.id, objetId, vendor: facture.vendor });
      setRecherche('');
      onClose();
    },
    [objetId, onClose, rattacher],
  );

  const renderItem = useCallback(
    ({ item }: { item: NonNullable<typeof data>[number] }) => (
      <Rangee facture={item} langue={i18n.language} onPress={() => choisir(item)} />
    ),
    [choisir, i18n.language],
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
          <Text className="flex-1 text-subheading font-bold text-ink">{t('factures.picker.title')}</Text>
        </View>

        <Text className="px-6 pb-3 text-label leading-5 text-ink-soft">{t('factures.picker.intro')}</Text>

        <View className="px-6">
          <TextField label={t('factures.picker.search')} value={recherche} onChangeText={setRecherche} />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            className="flex-1"
            data={factures}
            keyExtractor={(facture) => facture.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            windowSize={7}
            ListEmptyComponent={
              <Text className="mt-8 text-center text-label text-ink-soft">{t('factures.picker.empty')}</Text>
            }
          />
        )}
      </View>
    </Modal>
  );
}

function Rangee({
  facture,
  langue,
  onPress,
}: {
  facture: {
    id: string;
    document_url: string | null;
    vendor: string | null;
    purchase_date: string | null;
    amount: number | null;
    objet_names: string[] | null;
  };
  langue: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const vignette = useMediaSource(facture.document_url);
  const largeur = useScaled(44);
  const hauteur = useScaled(57);

  const date = fromIsoDate(facture.purchase_date, dateOrderFor(langue));
  const titre = facture.vendor || date || t('factures.block.untitled');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titre}
      onPress={onPress}
      className="mb-2 flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3 active:opacity-70"
    >
      <View
        style={{ width: largeur, height: hauteur }}
        className="overflow-hidden rounded-lg border border-ink/10 bg-sand-dark"
      >
        {vignette ? (
          <Image source={vignette} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="facture" size={16} color={colors.inkFaint} />
          </View>
        )}
      </View>

      {/* TROIS LIGNES, TOUJOURS, comme les cartes du dossier : le titre, le
          montant aligné, puis CE QUE LA FACTURE COUVRE DÉJÀ. Ce dernier point
          est celui qui permet de reconnaître le bon ticket quand on en a trois
          du même magasin le même jour. */}
      <View className="flex-1">
        <Text numberOfLines={1} className="text-body font-semibold text-ink">
          {titre}
        </Text>
        <Text
          numberOfLines={1}
          className={facture.amount != null ? 'text-label font-semibold text-ink' : 'text-label text-ink-faint'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {facture.amount != null
            ? new Intl.NumberFormat(langue, { style: 'currency', currency: 'EUR' }).format(Number(facture.amount))
            : t('factures.list.no_amount')}
        </Text>
        <Text numberOfLines={1} className="text-caption text-ink-soft">
          {[facture.vendor && date ? date : null, (facture.objet_names ?? []).join(', ')].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <Icon name="chevron" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}
