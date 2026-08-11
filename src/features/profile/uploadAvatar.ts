import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase/client';

const AVATAR_MAX_SIZE = 512;
const AVATAR_BUCKET = 'avatars';

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled) return null;

  const resized = await manipulateAsync(
    picked.assets[0].uri,
    [{ resize: { width: AVATAR_MAX_SIZE, height: AVATAR_MAX_SIZE } }],
    { compress: 0.8, format: SaveFormat.JPEG }
  );

  const file = new File(resized.uri);
  const bytes = await file.arrayBuffer();
  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?updated=${Date.now()}`;
}
