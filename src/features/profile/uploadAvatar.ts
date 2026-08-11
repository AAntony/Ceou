import { pickAndUploadImage } from '../../lib/images/pickAndUploadImage';

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  return pickAndUploadImage({
    bucket: 'avatars',
    path: `${userId}/avatar.jpg`,
    maxSize: 512,
    aspect: [1, 1],
  });
}
