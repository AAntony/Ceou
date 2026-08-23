import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { PLACEHOLDER_IMAGES, type EntityLevel } from '../features/inventory/placeholders';
import { logClientError } from '../lib/errorLogging';
import { pickImage, takePhoto } from '../lib/images/pickAndUploadImage';
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
  const colors = useThemeColors();
  const { t } = useTranslation();

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
      <Text className="mb-2 text-sm font-medium text-ink-soft">{t('inventory.photo.label')}</Text>

      <View className="flex-row items-center gap-4">
        <View
          style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
          className="overflow-hidden rounded-xl bg-sand"
        >
          <Image
            source={photoUri ? { uri: photoUri } : PLACEHOLDER_IMAGES[level]}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        </View>

        <View className="flex-1 gap-2">
          <Pressable
            onPress={() => choose('library')}
            accessibilityRole="button"
            className="flex-row items-center gap-2 rounded-xl border border-ink/10 px-3 py-2.5 active:opacity-70"
          >
            <Icon name="addPhoto" size={18} color="#1591EA" />
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {t('inventory.photo.choose')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => choose('camera')}
            accessibilityRole="button"
            className="flex-row items-center gap-2 rounded-xl border border-ink/10 px-3 py-2.5 active:opacity-70"
          >
            <Icon name="camera" size={18} color="#1591EA" />
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
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
              <Text className="flex-1 text-sm text-ink-soft" numberOfLines={1}>
                {t('inventory.photo.remove')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
