import * as ImageManipulator from 'expo-image-manipulator';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_GATEWAY_URL || '';

// In-memory cache for presigned download URLs (valid 1 hour)
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function uploadImage(uri: string): Promise<string> {
  if (!API_BASE_URL) return uploadImageMock(uri);

  // 1. Compress
  const compressedUri = await compressImage(uri);

  // 2. Get presigned upload URL
  const fileName = `item-${Date.now()}.jpg`;
  const response = await fetch(`${API_BASE_URL}/images/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, contentType: 'image/jpeg' }),
  });

  if (!response.ok) throw new Error('Failed to get upload URL');
  const { uploadUrl, key } = await response.json();

  // 3. Read file as blob and upload directly to S3
  const fileResponse = await fetch(compressedUri);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });

  if (!uploadResponse.ok) throw new Error('Failed to upload image to S3');

  return key;
}

export async function getImageUrl(key: string): Promise<string> {
  if (!API_BASE_URL) return getImageUrlMock(key);

  // Check cache
  const cached = urlCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const encodedKey = encodeURIComponent(key);
  const response = await fetch(`${API_BASE_URL}/images/${encodedKey}`);
  if (!response.ok) throw new Error('Failed to get image URL');

  const { url } = await response.json();

  // Cache for 50 minutes (URL valid for 60)
  urlCache.set(key, { url, expiresAt: Date.now() + 50 * 60 * 1000 });

  return url;
}

// ============ Mock Functions ============

export async function uploadImageMock(uri: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return `images/mock-${Date.now()}.jpg`;
}

export async function getImageUrlMock(key: string): Promise<string> {
  return key;
}
