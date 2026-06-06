import { createSkillParser } from './SkillParser';
import type { ParsedSkill, SkillImportUrlResult, SkillParseResult } from './types';

export type SkillFetchResult =
  | { ok: true; text: string }
  | { ok: false; status: number; error?: string };

export type SkillFetchFn = (url: string) => Promise<SkillFetchResult>;

export type SkillImportResult = ParsedSkill | { error: string };

export function resolveSkillImportUrl(input: string): SkillImportUrlResult {
  const parser = createSkillParser();
  const validated = parser.validateSkillImportUrl(input);
  if (!validated.ok) {
    return validated;
  }

  const url = new URL(validated.url);

  if (url.hostname === 'github.com') {
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (!match) {
      return { ok: false, error: 'GitHub URLs must link to a SKILL.md file (blob path)' };
    }
    const [, owner, repo, branch, path] = match;
    if (!path.endsWith('SKILL.md')) {
      return { ok: false, error: 'URL must point to a SKILL.md file' };
    }
    return {
      ok: true,
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    };
  }

  if (!url.pathname.includes('SKILL.md')) {
    return { ok: false, error: 'URL must point to a SKILL.md file' };
  }

  return { ok: true, url: validated.url };
}

export async function fetchSkillMarkdown(
  inputUrl: string,
  fetchFn: SkillFetchFn,
): Promise<{ ok: true; url: string; markdown: string } | { ok: false; error: string }> {
  const resolved = resolveSkillImportUrl(inputUrl);
  if (!resolved.ok) {
    return resolved;
  }

  const response = await fetchFn(resolved.url);
  if (!response.ok) {
    return {
      ok: false,
      error: response.error ?? `Failed to fetch skill (${response.status})`,
    };
  }

  const markdown = response.text.trim();
  if (!markdown.startsWith('---')) {
    return { ok: false, error: 'Fetched content is not a valid SKILL.md (missing frontmatter)' };
  }

  return { ok: true, url: resolved.url, markdown };
}

export async function importSkillFromUrl(
  inputUrl: string,
  fetchFn: SkillFetchFn,
): Promise<SkillImportResult> {
  const fetched = await fetchSkillMarkdown(inputUrl, fetchFn);
  if (!fetched.ok) {
    return { error: fetched.error };
  }

  const parser = createSkillParser();
  const parsed = parser.parseSkillMarkdown(fetched.markdown, {
    source: { type: 'url', uri: fetched.url },
  });
  if ('error' in parsed) {
    return parsed;
  }

  return parsed;
}

export function importSkillFromMarkdown(
  markdown: string,
  sourceUri = 'inline://skill',
): SkillParseResult {
  const parser = createSkillParser();
  return parser.parseSkillMarkdown(markdown, {
    source: { type: 'file', uri: sourceUri },
  });
}
