import {
  evaluateJsSkillScriptMock,
  parseJsSkillBridgeResponse,
  parseRunJsArgs,
  resolveSkillScriptHtml,
  skillAllowsNetwork,
} from './jsSkillBridge';
import type { JsSkillRunRequest, JsSkillRunResult, JsSkillWebViewBridge } from './jsSkillTypes';
import type { InstalledSkill } from './types';

export interface JsSkillRunnerDeps {
  getSkillByName(name: string): InstalledSkill | undefined;
  getActiveSkillName(): string | undefined;
  bridge: JsSkillWebViewBridge;
  useMockEvaluate?: boolean;
}

export class MockJsSkillWebViewBridge implements JsSkillWebViewBridge {
  async evaluate(scriptHtml: string, data: string): Promise<string> {
    return evaluateJsSkillScriptMock(scriptHtml, data);
  }
}

export class JsSkillRunner {
  constructor(private readonly deps: JsSkillRunnerDeps) {}

  async run(request: JsSkillRunRequest): Promise<JsSkillRunResult> {
    const parsedArgs = parseRunJsArgs({
      scriptName: request.scriptName,
      data: request.data,
      skillName: request.skillName,
      secret: request.secret,
    });

    const skillName = parsedArgs.skillName ?? this.deps.getActiveSkillName();
    if (!skillName) {
      return { error: 'No active JavaScript skill. Invoke one with /skill-name first.' };
    }

    const skill = this.deps.getSkillByName(skillName);
    if (!skill) {
      return { error: `Unknown JavaScript skill: ${skillName}` };
    }
    if (skill.kind !== 'javascript') {
      return { error: `Skill "${skillName}" is not a JavaScript skill` };
    }
    if (!skill.enabled) {
      return { error: `Skill "${skillName}" is disabled` };
    }

    const script = resolveSkillScriptHtml(skill, parsedArgs.scriptName);
    if (typeof script !== 'string') {
      return { error: script.error };
    }

    const allowNetwork = skillAllowsNetwork(skill.frontmatter.compatibility);
    const raw = await this.deps.bridge.evaluate(script, parsedArgs.data, {
      secret: parsedArgs.secret,
      allowNetwork,
    });

    return parseJsSkillBridgeResponse(raw);
  }
}

export function createJsSkillRunner(deps: JsSkillRunnerDeps): JsSkillRunner {
  return new JsSkillRunner(deps);
}
