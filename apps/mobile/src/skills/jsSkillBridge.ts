import type { InstalledSkill } from './types';

export function skillAllowsNetwork(compatibility?: string): boolean {
  if (!compatibility?.trim()) {
    return false;
  }
  return /\bnetwork\b|\bfetch\b|\binternet\b|\bhttps?\b/i.test(compatibility);
}

export function parseRunJsArgs(args: Record<string, unknown>): {
  scriptName: string;
  data: string;
  skillName?: string;
  secret?: string;
} {
  const data =
    typeof args.data === 'string'
      ? args.data
      : JSON.stringify(args.data ?? {});

  return {
    scriptName: typeof args.scriptName === 'string' ? args.scriptName : 'index.html',
    data,
    skillName: typeof args.skillName === 'string' ? args.skillName : undefined,
    secret: typeof args.secret === 'string' ? args.secret : undefined,
  };
}

export function resolveSkillScriptHtml(
  skill: InstalledSkill,
  scriptName = 'index.html',
): string | { error: string } {
  if (scriptName !== 'index.html') {
    return { error: `Unsupported scriptName "${scriptName}" (only index.html in Phase 3 S3)` };
  }
  if (!skill.scriptHtml?.trim()) {
    return { error: `JS skill "${skill.frontmatter.name}" has no bundled scriptHtml` };
  }
  return skill.scriptHtml;
}

export function buildWebViewEvaluateScript(data: string, secret?: string): string {
  const payload = JSON.stringify(data);
  const secretArg = secret ? JSON.stringify(secret) : 'undefined';
  return `(async function() {
    try {
      if (typeof window.ai_edge_gallery_get_result !== 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'ai_edge_gallery_get_result is not defined' }));
        return;
      }
      const response = await window.ai_edge_gallery_get_result(${payload}, ${secretArg});
      window.ReactNativeWebView.postMessage(typeof response === 'string' ? response : JSON.stringify(response));
    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ error: String(error && error.message ? error.message : error) }));
    }
  })(); true;`;
}

export function parseJsSkillBridgeResponse(raw: string): { result?: string; error?: string } {
  try {
    const parsed = JSON.parse(raw) as { result?: unknown; error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) {
      return { error: parsed.error };
    }
    if (typeof parsed.result === 'string') {
      return { result: parsed.result };
    }
    return { error: 'Invalid JS skill response (expected result or error string)' };
  } catch {
    return { error: 'Invalid JS skill response JSON' };
  }
}

/** Mock path: evaluate bundled Gallery-style script without a WebView. */
export async function evaluateJsSkillScriptMock(scriptHtml: string, data: string): Promise<string> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: 'Invalid run_js data JSON' });
  }

  if (/hash-demo/.test(scriptHtml) && typeof parsed.text === 'string') {
    return JSON.stringify({
      result: `hash-demo:${parsed.text.split('').reverse().join('')}`,
    });
  }

  return JSON.stringify({ result: 'mock-js-skill-ok' });
}
