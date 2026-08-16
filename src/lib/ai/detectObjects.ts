import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../supabase/client';

export type Detection = {
  label: string;
  box: { x: number; y: number; width: number; height: number };
};

export type PreparedPhoto = { uri: string; width: number; height: number; base64: string };

const DETECTION_MAX_WIDTH = 1024;

// Même largeur max que l'upload final (uploadImage, pickAndUploadImage.ts) —
// garde la requête vers l'Edge Function raisonnable, et sert de repère de
// dimensions stable pour découper les vignettes ensuite : les box_2d que
// Gemini renvoie sont relatifs à CETTE image redimensionnée, donc le
// découpage (cropDetection) se fait depuis cette même copie, jamais depuis
// la photo source d'origine.
export async function preparePhotoForDetection(uri: string): Promise<PreparedPhoto> {
  const result = await manipulateAsync(uri, [{ resize: { width: DETECTION_MAX_WIDTH } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error('image_manipulation_failed');
  return { uri: result.uri, width: result.width, height: result.height, base64: result.base64 };
}

export async function detectObjects(photo: PreparedPhoto): Promise<Detection[]> {
  const { data, error } = await supabase.functions.invoke<{ detections: Detection[] }>('detect-objects', {
    body: { imageBase64: photo.base64, mimeType: 'image/jpeg' },
  });
  if (error) throw error;
  return data?.detections ?? [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Découpe une vignette locale pour une détection donnée — la box est relative
// (0..1), donc appliquée directement contre les dimensions PIXEL de la photo
// déjà redimensionnée (voir preparePhotoForDetection), sans avoir besoin de
// connaître les dimensions de la photo source d'origine.
export async function cropDetection(photo: PreparedPhoto, box: Detection['box']): Promise<string> {
  const originX = clamp(Math.round(box.x * photo.width), 0, photo.width - 1);
  const originY = clamp(Math.round(box.y * photo.height), 0, photo.height - 1);
  const width = clamp(Math.round(box.width * photo.width), 1, photo.width - originX);
  const height = clamp(Math.round(box.height * photo.height), 1, photo.height - originY);

  const result = await manipulateAsync(photo.uri, [{ crop: { originX, originY, width, height } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
