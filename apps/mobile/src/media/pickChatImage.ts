import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

export interface PickedChatImage {
  uri: string;
  nativePath: string;
}

export async function pickChatImage(
  source: 'camera' | 'library',
): Promise<PickedChatImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera permission is required to take a photo.'
        : 'Photo library permission is required to pick an image.',
    );
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const uri = result.assets[0].uri;
  const nativePath = await persistImageForNative(uri);
  return { uri, nativePath };
}

export async function persistImageForNative(sourceUri: string): Promise<string> {
  const dir = new Directory(Paths.cache, 'chat-images');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const extension = sourceUri.includes('.') ? sourceUri.split('.').pop() : 'jpg';
  const target = new File(dir, `image-${Date.now()}.${extension ?? 'jpg'}`);
  const source = new File(sourceUri);
  await source.copy(target);
  return target.uri.replace(/^file:\/\//, '');
}
