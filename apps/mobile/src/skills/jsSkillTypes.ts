export interface JsSkillRunRequest {
  scriptName?: string;
  data: string;
  skillName?: string;
  secret?: string;
}

export interface JsSkillRunResult {
  result?: string;
  error?: string;
}

export interface JsSkillWebViewBridge {
  evaluate(
    scriptHtml: string,
    data: string,
    options?: { secret?: string; allowNetwork?: boolean },
  ): Promise<string>;
}
