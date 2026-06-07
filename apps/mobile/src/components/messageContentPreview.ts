export const DEFAULT_PREVIEW_LINE_COUNT = 6;
export const DEFAULT_PREVIEW_CHAR_COUNT = 400;

export function shouldTruncateContent(
  content: string,
  maxLines = DEFAULT_PREVIEW_LINE_COUNT,
  maxChars = DEFAULT_PREVIEW_CHAR_COUNT,
): boolean {
  if (content.length > maxChars) {
    return true;
  }
  return content.split('\n').length > maxLines;
}

export function truncateContentPreview(
  content: string,
  maxLines = DEFAULT_PREVIEW_LINE_COUNT,
  maxChars = DEFAULT_PREVIEW_CHAR_COUNT,
): string {
  const byLines = content.split('\n').slice(0, maxLines).join('\n');
  if (byLines.length <= maxChars) {
    return byLines;
  }
  return byLines.slice(0, maxChars);
}
