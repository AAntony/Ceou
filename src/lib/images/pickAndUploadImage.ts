import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase/client';

export async function pickImage(aspect?: [number, number], allowsEditing = true): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing,
    aspect,
    quality: 1,
  });
  if (picked.canceled) return null;
  return picked.assets[0].uri;
}

// Pendant du pickImage() ci-dessus mais via l'appareil photo. Même défaut
// `allowsEditing = true` pour rester cohérent avec pickImage — c'est
// l'appelant qui passe `false` quand il a besoin de la scène entière sans
// recadrage forcé (cas du scan IA multi-objets, AiPhotoScanFlow).
export async function takePhoto(aspect?: [number, number], allowsEditing = true): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const taken = await ImagePicker.launchCameraAsync({
    allowsEditing,
    aspect,
    quality: 1,
  });
  if (taken.canceled) return null;
  return taken.assets[0].uri;
}

type UploadImageOptions = {
  bucket: string;
  path: string;
  maxSize?: number;
};

/**
 * fetch().blob() reads the local uri uniformly on web (blob:/data:) and
 * native (file:) — expo-file-system's File class only understands device
 * paths and crashes on web (see uploadAvatar history).
 */
export async function uploadImage(uri: string, { bucket, path, maxSize = 1024 }: UploadImageOptions): Promise<string> {
  const resized = await manipulateAsync(uri, [{ resize: { width: maxSize } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });

  const blob = await (await fetch(resized.uri)).blob();

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?updated=${Date.now()}`;
}

type PickAndUploadImageOptions = UploadImageOptions & { aspect?: [number, number] };

export async function pickAndUploadImage({ aspect, ...uploadOptions }: PickAndUploadImageOptions): Promise<string | null> {
  const uri = await pickImage(aspect);
  if (!uri) return null;
  return uploadImage(uri, uploadOptions);
}
