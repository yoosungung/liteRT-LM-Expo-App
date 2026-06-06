import type { MessageAttachment } from 'litertlm-native';

import type { ModelId } from '../models/manifest';
import { getManifestEntry } from '../models/manifest';

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
  options: { hasImage: boolean },
): string | null {
  const trimmed = text.trim();
  if (trimmed) {
    return trimmed;
  }
  if (options.hasImage) {
    return defaultImagePrompt;
  }
  return null;
}

export function buildUserMessageAttachments(imageUri?: string): MessageAttachment[] | undefined {
  if (!imageUri) {
    return undefined;
  }
  return [{ type: 'image', uri: imageUri }];
}

export type { MessageAttachment };
