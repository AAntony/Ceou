import { FunctionsHttpError } from '@supabase/supabase-js';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image as RNImage } from 'react-native';
import { supabase } from '../supabase/client';

export type Detection = {
  label: string;
  box: { x: number; y: number; width: number; height: number };
};

export class RateLimitedError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('rate_limited');
    this.name = 'RateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Taille envoyée à Gemini pour la détection — n'a AUCUN rapport avec la
// résolution des vignettes gardées ensuite (voir cropDetection ci-dessous) :
// juste de quoi garder la requête légère, la détection n'a pas besoin de
// finesse pixel-perfect pour repérer un objet.
const DETECTION_MAX_WIDTH = 1024;

export function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

async function encodeForDetection(uri: string): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: DETECTION_MAX_WIDTH } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error('image_manipulation_failed');
  return result.base64;
}

export async function detectObjects(uri: string): Promise<Detection[]> {
  const base64 = await encodeForDetection(uri);
  const { data, error } = await supabase.functions.invoke<{ detections: Detection[] }>('detect-objects', {
    body: { imageBase64: base64, mimeType: 'image/jpeg' },
  });
  if (error) {
    // Convertit la réponse 429 de l'Edge Function (voir detect-objects,
    // check_and_touch_ai_scan_rate_limit) en erreur typée reconnaissable par
    // l'UI — sinon AiPhotoScanFlow ne pourrait pas distinguer "quota Gemini
    // partagé throttlé" d'une vraie panne et afficherait un message générique
    // trompeur. Dégrade silencieusement vers l'erreur générique existante si
    // le corps ne correspond pas à la forme attendue (ne jamais planter sur
    // cette étape purement cosmétique).
    if (error instanceof FunctionsHttpError && error.context.status === 429) {
      try {
        const body = await error.context.clone().json();
        if (body?.error === 'rate_limited') throw new RateLimitedError(body.retryAfterSeconds ?? 60);
      } catch (parsed) {
        if (parsed instanceof RateLimitedError) throw parsed;
      }
    }
    throw error;
  }
  return data?.detections ?? [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Découpe une vignette depuis la photo ORIGINALE en pleine résolution — PAS
// depuis la copie réduite (1024px) envoyée à Gemini pour la détection.
// Découper depuis la copie réduite produisait des vignettes minuscules pour
// les petits objets d'une photo de scène (ex: un objet occupant 1/10 d'une
// image de 1024px = ~100px de large), qui ressortaient floues/pixélisées une
// fois réagrandies par uploadImage(). Les box_2d de Gemini étant relatives
// (0..1), elles s'appliquent identiquement à N'IMPORTE QUELLE résolution de
// la même photo — rien n'oblige à découper depuis la copie envoyée à l'API.
export async function cropDetection(
  originalUri: string,
  originalSize: { width: number; height: number },
  box: Detection['box'],
): Promise<string> {
  const originX = clamp(Math.round(box.x * originalSize.width), 0, originalSize.width - 1);
  const originY = clamp(Math.round(box.y * originalSize.height), 0, originalSize.height - 1);
  const width = clamp(Math.round(box.width * originalSize.width), 1, originalSize.width - originX);
  const height = clamp(Math.round(box.height * originalSize.height), 1, originalSize.height - originY);

  const result = await manipulateAsync(originalUri, [{ crop: { originX, originY, width, height } }], {
    compress: 0.9,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
