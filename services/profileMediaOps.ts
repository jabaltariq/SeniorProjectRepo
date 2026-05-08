import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/models/constants';
import { setCustomProfileAvatar } from '@/services/dbOps';

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadProfileAvatarResult =
  | { success: true; url: string }
  | { success: false; error: 'INVALID_FILE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' };

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName) return fromName.slice(0, 8);
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadProfileAvatar(uid: string, file: File): Promise<UploadProfileAvatarResult> {
  if (!uid || !file.type.startsWith('image/')) return { success: false, error: 'INVALID_FILE' };
  if (file.size > MAX_PROFILE_IMAGE_BYTES) return { success: false, error: 'FILE_TOO_LARGE' };

  try {
    const path = `profileAvatars/${uid}/avatar-${Date.now()}.${extensionFor(file)}`;
    const uploadRef = ref(storage, path);
    await uploadBytes(uploadRef, file, {
      contentType: file.type,
      customMetadata: { uid },
    });
    const url = await getDownloadURL(uploadRef);
    await setCustomProfileAvatar(uid, url);
    return { success: true, url };
  } catch (error) {
    console.error('uploadProfileAvatar failed', error);
    return { success: false, error: 'UPLOAD_FAILED' };
  }
}
