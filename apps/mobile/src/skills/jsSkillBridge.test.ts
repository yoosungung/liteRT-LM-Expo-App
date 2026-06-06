import { describe, expect, it } from 'vitest';

import {
  buildWebViewEvaluateScript,
  evaluateJsSkillScriptMock,
  parseJsSkillBridgeResponse,
  parseRunJsArgs,
  resolveSkillScriptHtml,
  skillAllowsNetwork,
} from './jsSkillBridge';
import type { InstalledSkill } from './types';

const HASH_DEMO_SCRIPT = `<!DOCTYPE html><html><body><script>
window.ai_edge_gallery_get_result = async (data) => {
  const json = JSON.parse(data);
  return JSON.stringify({ result: 'hash-demo:' + String(json.text || '').split('').reverse().join('') });
};
</script></body></html>`;

describe('jsSkillBridge', () => {
  it('parseRunJsArgs normalizes Gallery run_js parameters', () => {
    expect(
      parseRunJsArgs({
        scriptName: 'index.html',
        data: '{"text":"hello"}',
        skillName: 'hash-demo',
      }),
    ).toEqual({
      scriptName: 'index.html',
      data: '{"text":"hello"}',
      skillName: 'hash-demo',
      secret: undefined,
    });
  });

  it('skillAllowsNetwork is opt-in via compatibility text', () => {
    expect(skillAllowsNetwork(undefined)).toBe(false);
    expect(skillAllowsNetwork('offline only')).toBe(false);
    expect(skillAllowsNetwork('Requires network access for fetch API')).toBe(true);
  });

  it('resolveSkillScriptHtml requires bundled index.html', () => {
    const skill: InstalledSkill = {
      frontmatter: { name: 'hash-demo', description: 'demo' },
      instructions: 'run_js',
      kind: 'javascript',
      source: { type: 'bundled', uri: 'bundled://hash-demo' },
      enabled: true,
      installedAt: 1,
      scriptHtml: HASH_DEMO_SCRIPT,
    };
    expect(resolveSkillScriptHtml(skill)).toBe(HASH_DEMO_SCRIPT);
    expect(resolveSkillScriptHtml(skill, 'missing.html')).toEqual({
      error: 'Unsupported scriptName "missing.html" (only index.html in Phase 3 S3)',
    });
  });

  it('evaluateJsSkillScriptMock returns Gallery-shaped JSON', async () => {
    const raw = await evaluateJsSkillScriptMock(HASH_DEMO_SCRIPT, '{"text":"abc"}');
    expect(parseJsSkillBridgeResponse(raw)).toEqual({ result: 'hash-demo:cba' });
  });

  it('buildWebViewEvaluateScript posts ai_edge_gallery_get_result result', () => {
    const script = buildWebViewEvaluateScript('{"text":"hi"}', 'secret-key');
    expect(script).toContain('window.ai_edge_gallery_get_result');
    expect(script).toContain('ReactNativeWebView.postMessage');
    expect(script).toContain('"secret-key"');
  });
});
