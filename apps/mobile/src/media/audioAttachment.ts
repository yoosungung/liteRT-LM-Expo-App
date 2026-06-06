import type { MessageAttachment } from 'litertlm-native';

import type { ModelId } from '../models/manifest';
import { getManifestEntry } from '../models/manifest';

export const defaultAudioPrompt = 'Transcribe or summarize this audio clip.';

export function modelSupportsAudio(modelId: ModelId | string): boolean {
  try {
    return getManifestEntry(modelId as ModelId).modalities.includes('audio');
  } catch {
    return false;
  }
}

export function normalizeMultimodalTurnText(
  text: string,
  options: { hasImage: boolean; hasAudio: boolean },
): string | null {
  const trimmed = text.trim();
  if (trimmed) {
    return trimmed;
  }
  if (options.hasImage) {
    return 'Describe this image.';
  }
  if (options.hasAudio) {
    return defaultAudioPrompt;
  }
  return null;
}

export function buildUserMessageAttachments(options: {
  imageUri?: string;
  audioUri?: string;
}): MessageAttachment[] | undefined {
  const attachments: MessageAttachment[] = [];
  if (options.imageUri) {
    attachments.push({ type: 'image', uri: options.imageUri });
  }
  if (options.audioUri) {
    attachments.push({ type: 'audio', uri: options.audioUri });
  }
  return attachments.length > 0 ? attachments : undefined;
}

export type { MessageAttachment };
