import { describe, expect, it } from 'vitest';

import { getManifestEntry } from '../models/manifest';
import {
  defaultImagePrompt,
  modelSupportsImage,
  normalizeUserTurnText,
} from './imageAttachment';

describe('imageAttachment', () => {
  it('modelSupportsImage is true when manifest includes image', () => {
    expect(modelSupportsImage('gemma-4-e2b')).toBe(true);
    expect(getManifestEntry('gemma-4-e2b').modalities).toContain('image');
  });

  it('normalizeUserTurnText uses default prompt for image-only turns', () => {
    expect(normalizeUserTurnText('', { hasImage: true })).toBe(defaultImagePrompt);
    expect(normalizeUserTurnText('  describe colors  ', { hasImage: true })).toBe(
      'describe colors',
    );
  });

  it('normalizeUserTurnText rejects empty text-only turns', () => {
    expect(normalizeUserTurnText('', { hasImage: false })).toBeNull();
    expect(normalizeUserTurnText(' hello ', { hasImage: false })).toBe('hello');
  });
});
