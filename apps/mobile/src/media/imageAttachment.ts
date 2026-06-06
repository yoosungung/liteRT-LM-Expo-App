import type { MessageAttachment } from 'litertlm-native';

import type { ModelId } from '../models/manifest';
import { getManifestEntry } from '../models/manifest';
import { normalizeMultimodalTurnText } from './audioAttachment';

export const defaultImagePrompt = 'Describe this image.';

export function modelSupportsImage(modelId: ModelId | string): boolean {
  try {
    return getManifestEntry(modelId as ModelId).modalities.includes('image');
  } catch {
    return false;
  }
}

export function normalizeUserTurnText(
  text: string,
  options: { hasImage: boolean; hasAudio?: boolean },
): string | null {
  return normalizeMultimodalTurnText(text, {
    hasImage: options.hasImage,
    hasAudio: options.hasAudio ?? false,
  });
}

export function buildUserMessageAttachments(imageUri?: string): MessageAttachment[] | undefined {
  if (!imageUri) {
    return undefined;
  }
  return [{ type: 'image', uri: imageUri }];
}

export type { MessageAttachment };
