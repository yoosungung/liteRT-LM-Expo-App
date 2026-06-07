import { describe, expect, it } from 'vitest';

import {
  shouldTruncateContent,
  truncateContentPreview,
} from './messageContentPreview';

describe('messageContentPreview', () => {
  it('does not truncate short content', () => {
    expect(shouldTruncateContent('Hello')).toBe(false);
  });

  it('truncates when line count exceeds limit', () => {
    const content = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join('\n');
    expect(shouldTruncateContent(content)).toBe(true);
    expect(truncateContentPreview(content)).toBe(
      Array.from({ length: 6 }, (_, i) => `line ${i + 1}`).join('\n'),
    );
  });

  it('truncates when char count exceeds limit', () => {
    const content = 'a'.repeat(500);
    expect(shouldTruncateContent(content)).toBe(true);
    expect(truncateContentPreview(content).length).toBe(400);
  });
});
