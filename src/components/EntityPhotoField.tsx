import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { PLACEHOLDER_IMAGES, type EntityLevel } from '../features/inventory/placeholders';
import { logClientError } from '../lib/errorLogging';
import { pickImage, takePhoto } from '../lib/images/pickAndUploadImage';
import { STACK_SCALE, useScaled, useTextScale } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';
import { Icon } from './Icon';

// Choix de photo, commun aux quatre niveaux de l'inventaire.
//
// Ne téléverse RIEN : le champ ne manipule qu'une uri locale et remonte le
// choix à l'écran appelant, qui téléverse au moment de valider. La raison
// est concrète — la photo doit être nommée d'après l'identifiant de la
// ligne, or à la création cet identifiant n'existe pas encore. Téléverser
// tout de suite laisserait des fichiers orphelins dès qu'un utilisateur
// choisit une photo puis annule.
//
// L'aperçu montre l'illustration par défaut quand rien n'est choisi : ce
// qu'on voit dans le formulaire est exactement ce qui apparaîtra dans la
// liste, y compris si on ne met pas de photo.

const PREVIEW_WIDTH = 132;
// 4:3, le ratio des vignettes de liste et des illustrations par défaut.
const PREVIEW_HEIGHT = 99;

type EntityPhotoFieldProps = {
  level: EntityLevel;
  /** Uri locale (choix en cours) ou URL distante (photo déjà enregistrée). */
  photoUri: string | null;
  onChange: (uri: string | null) => void;
};

export function EntityPhotoField({ level, photoUri, onChange }: EntityPhotoFieldProps) {
  // L'apercu est dessine en pixels (ratio 4:3 impose), donc hors de portee de
  // `rem` : il grandit avec le texte plutot que de rester une vignette.
  const previewWidth = useScaled(PREVIEW_WIDTH);
  const previewHeight = useScaled(PREVIEW_HEIGHT);
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { textScale } = useTextScale();

  // EN GRAND TEXTE, LES TROIS BOUTONS PASSENT SOUS LA PHOTO.
  //
  // A cote d'elle, ils n'ont que la largeur restante : « Choisir une photo »
  // et « Prendre une photo » y etaient tronques des x1,3, et la photo elle-
  // meme grandissant avec le reglage, la place ne faisait que se reduire.
  // Sous elle, chaque bouton a toute la largeur de la feuille.
  const below = textScale >= STACK_SCALE;

  const choose = async (source: 'library' | 'camera') => {
    try {
      // Recadrage imposé au format de la vignette : sinon une photo verticale
      // se retrouve rognée à l'affichage sans que l'utilisateur ait eu son
      // mot à dire sur ce qu'on garde.
      const uri = source === 'camera' ? await takePhoto([4, 3]) : await pickImage([4, 3]);
      if (uri) onChange(uri);
    } catch (error) {
      logClientError(error, { source: 'entity_photo_field', level });
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <View className="mb-4">
      <Text className="mb-2 text-label font-medium text-ink-soft">{t('inventory.photo.label')}</Text>

      <View className={below ? 'gap-3' : 'flex-row items-center gap-4'}>
        <View
          style={below ? { width: '100%', height: previewHeight } : { width: previewWidth, height: previewHeight }}
          className="overflow-hidden rounded-xl bg-sand"
        >
          <Image
            source={photoUri ? { uri: photoUri } : PLACEHOLDER_IMAGES[level]}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        </View>

        <View className={below ? 'gap-2' : 'flex-1 gap-2'}>
          <Pressable
            onPress={() => choose('library')}
            accessibilityRole="button"
            className="flex-row items-center gap-2 rounded-xl border border-ink/10 px-3 py-2.5 active:opacity-70"
          >
            <Icon name="addPhoto" size={18} color="#1591EA" />
            <Text className="flex-1 text-label text-ink" numberOfLines={below ? 2 : 1}>
              {t('inventory.photo.choose')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => choose('camera')}
            accessibilityRole="button"
            className="flex-row items-center gap-2 rounded-xl border border-ink/10 px-3 py-2.5 active:opacity-70"
          >
            <Icon name="camera" size={18} color="#1591EA" />
            <Text className="flex-1 text-label text-ink" numberOfLines={below ? 2 : 1}>
              {t('inventory.photo.take')}
            </Text>
          </Pressable>

          {/* Uniquement quand il y a quelque chose à retirer : toujours
              visible, ce bouton passerait pour « supprimer l'élément ». */}
          {photoUri ? (
            <Pressable
              onPress={() => onChange(null)}
              accessibilityRole="button"
              className="flex-row items-center gap-2 px-3 py-1.5 active:opacity-70"
            >
              <Icon name="close" size={16} color={colors.inkFaint} />
              <Text className="flex-1 text-label text-ink-soft" numberOfLines={below ? 2 : 1}>
                {t('inventory.photo.remove')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
