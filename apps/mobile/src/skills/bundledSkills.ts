import type { InstalledSkill, SkillKind, SkillSource } from './types';

export const BUNDLED_FITNESS_COACH_MARKDOWN = `---
name: fitness-coach
description: A cheerful, high-energy fitness coach that provides motivational workout routines.
---

# Cheerful Fitness Coach

You are an upbeat fitness coach. When the user asks for a workout:

1. Start with a high-energy greeting.
2. Provide a 15-minute routine that is easy to follow.
3. End with encouragement.
`;

export const BUNDLED_HASH_DEMO_SCRIPT_HTML = `<!DOCTYPE html>
<html lang="en">
<body>
  <script>
    window.ai_edge_gallery_get_result = async (data) => {
      try {
        const jsonData = JSON.parse(data);
        const text = typeof jsonData.text === 'string' ? jsonData.text : '';
        return JSON.stringify({ result: 'hash-demo:' + text.split('').reverse().join('') });
      } catch (error) {
        return JSON.stringify({ error: String(error && error.message ? error.message : error) });
      }
    };
  </script>
</body>
</html>`;

export const BUNDLED_HASH_DEMO_MARKDOWN = `---
name: hash-demo
description: Demo JavaScript skill that reverses input text via the run_js sandbox.
---

# Hash Demo (JavaScript)

**Use only the \`run_js\` tool — never call \`hash-demo\` as a tool name.**

When the user asks to reverse text, call the \`run_js\` tool with:

- scriptName: index.html
- data: a JSON string \`{"text":"<user text>"}\`
`;

export interface BundledSkillEntry {
  markdown: string;
  source: SkillSource;
  scriptHtml?: string;
}

export const BUNDLED_SKILLS: BundledSkillEntry[] = [
  {
    markdown: BUNDLED_FITNESS_COACH_MARKDOWN,
    source: { type: 'bundled', uri: 'bundled://fitness-coach' },
  },
  {
    markdown: BUNDLED_HASH_DEMO_MARKDOWN,
    source: { type: 'bundled', uri: 'bundled://hash-demo' },
    scriptHtml: BUNDLED_HASH_DEMO_SCRIPT_HTML,
  },
];

export function createBundledInstalledSkills(now = Date.now()): InstalledSkill[] {
  return BUNDLED_SKILLS.map((entry) => {
    const nameMatch = entry.markdown.match(/^name:\s*(.+)$/m);
    const descriptionMatch = entry.markdown.match(/^description:\s*(.+)$/m);
    const name = nameMatch?.[1]?.trim() ?? 'unknown';
    const description = descriptionMatch?.[1]?.trim() ?? '';
    const bodyStart = entry.markdown.indexOf('\n---', 4);
    const instructions =
      bodyStart >= 0 ? entry.markdown.slice(bodyStart + 4).replace(/^\r?\n/, '').trim() : '';
    const kind: SkillKind = /\brun_js\b/.test(entry.markdown) ? 'javascript' : 'text';

    return {
      frontmatter: { name, description },
      instructions,
      kind,
      source: entry.source,
      scriptHtml: entry.scriptHtml,
      enabled: true,
      installedAt: now,
    };
  });
}
