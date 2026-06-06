import type { ToolDefinition } from 'litertlm-native';

/** Gallery JS skill bridge tool — executes hidden WebView sandbox via `run_js`. */
export const RUN_JS_TOOL_DEFINITION: ToolDefinition = {
  name: 'run_js',
  description:
    'Execute the active JavaScript skill in a sandboxed WebView. Pass stringified JSON in `data` per the skill SKILL.md schema.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      scriptName: {
        type: 'string',
        description: 'Skill script entrypoint, typically index.html',
      },
      data: {
        type: 'string',
        description: 'Stringified JSON parameters for window.ai_edge_gallery_get_result',
      },
      skillName: {
        type: 'string',
        description: 'Optional skill id override when multiple JS skills are installed',
      },
    },
    required: ['data'],
    additionalProperties: false,
  },
  riskLevel: 'write',
  requiresApproval: false,
};
