import { supabase } from '@/lib/supabase';

// Generate a random unique filename for storage paths
const generateFileName = (ext: string) => {
  const rand = Math.random().toString(36).substring(2, 11);
  return `${rand}-${Date.now()}.${ext}`;
};

// 1. uploadPhoto
export async function uploadPhoto(file: Blob | File): Promise<string> {
  const path = `photos/${generateFileName('png')}`;
  const { data, error } = await supabase.storage
    .from('photobooth')
    .upload(path, file, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
  return data.path;
}

// 2. uploadGif
export async function uploadGif(file: Blob | File): Promise<string> {
  const path = `gifs/${generateFileName('gif')}`;
  const { data, error } = await supabase.storage
    .from('photobooth')
    .upload(path, file, {
      contentType: 'image/gif',
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading GIF:', error);
    throw error;
  }
  return data.path;
}

// 3. uploadBoomerang
export async function uploadBoomerang(file: Blob | File): Promise<string> {
  const path = `boomerangs/${generateFileName('gif')}`;
  const { data, error } = await supabase.storage
    .from('photobooth')
    .upload(path, file, {
      contentType: 'image/gif',
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading boomerang:', error);
    throw error;
  }
  return data.path;
}

// 4. generatePublicUrl
export function generatePublicUrl(path: string): string {
  const { data } = supabase.storage
    .from('photobooth')
    .getPublicUrl(path);
  return data.publicUrl;
}
