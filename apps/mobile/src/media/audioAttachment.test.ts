import { describe, expect, it } from 'vitest';

import {
  buildUserMessageAttachments,
  modelSupportsAudio,
  normalizeMultimodalTurnText,
} from './audioAttachment';

describe('audioAttachment', () => {
  it('gates audio input by manifest modalities', () => {
    expect(modelSupportsAudio('gemma-4-e2b')).toBe(true);
    expect(modelSupportsAudio('unknown-model')).toBe(false);
  });

  it('uses default audio prompt when text is empty', () => {
    expect(normalizeMultimodalTurnText('', { hasImage: false, hasAudio: true })).toBe(
      'Transcribe or summarize this audio clip.',
    );
  });

  it('builds audio attachments for session storage', () => {
    expect(
      buildUserMessageAttachments({ audioUri: 'file:///tmp/audio.m4a' }),
    ).toEqual([{ type: 'audio', uri: 'file:///tmp/audio.m4a' }]);
  });
});
