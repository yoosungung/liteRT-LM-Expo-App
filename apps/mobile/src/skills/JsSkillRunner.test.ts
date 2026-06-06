import { describe, expect, it } from 'vitest';

import { JsSkillRunner, MockJsSkillWebViewBridge } from './JsSkillRunner';
import type { InstalledSkill } from './types';

const HASH_DEMO_SCRIPT = `<!DOCTYPE html><html><body><script>
window.ai_edge_gallery_get_result = async (data) => {
  const json = JSON.parse(data);
  return JSON.stringify({ result: 'hash-demo:' + String(json.text || '').split('').reverse().join('') });
};
</script></body></html>`;

function hashDemoSkill(overrides: Partial<InstalledSkill> = {}): InstalledSkill {
  return {
    frontmatter: { name: 'hash-demo', description: 'Demo JS skill' },
    instructions: 'Call run_js with data JSON { "text": "..." }',
    kind: 'javascript',
    source: { type: 'bundled', uri: 'bundled://hash-demo' },
    enabled: true,
    installedAt: 1,
    scriptHtml: HASH_DEMO_SCRIPT,
    ...overrides,
  };
}

describe('JsSkillRunner', () => {
  it('runs bundled JS skill via mock WebView bridge (Gallery contract)', async () => {
    const skills = new Map<string, InstalledSkill>([['hash-demo', hashDemoSkill()]]);
    const runner = new JsSkillRunner({
      getSkillByName: (name) => skills.get(name),
      getActiveSkillName: () => 'hash-demo',
      bridge: new MockJsSkillWebViewBridge(),
    });

    const result = await runner.run({
      data: JSON.stringify({ text: 'hello' }),
      scriptName: 'index.html',
    });

    expect(result).toEqual({ result: 'hash-demo:olleh' });
  });

  it('returns error when no active JS skill is set', async () => {
    const runner = new JsSkillRunner({
      getSkillByName: () => undefined,
      getActiveSkillName: () => undefined,
      bridge: new MockJsSkillWebViewBridge(),
    });

    expect(await runner.run({ data: '{}' })).toEqual({
      error: 'No active JavaScript skill. Invoke one with /skill-name first.',
    });
  });

  it('rejects disabled skills', async () => {
    const runner = new JsSkillRunner({
      getSkillByName: () => hashDemoSkill({ enabled: false }),
      getActiveSkillName: () => 'hash-demo',
      bridge: new MockJsSkillWebViewBridge(),
    });

    expect(await runner.run({ data: '{"text":"x"}' })).toEqual({
      error: 'Skill "hash-demo" is disabled',
    });
  });
});
