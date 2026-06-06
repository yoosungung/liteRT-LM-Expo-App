import type { ToolDefinition } from 'litertlm-native';

export interface FilterToolsOptions {
  /** Keep `run_js` available for active JavaScript skills even if not listed. */
  includeRunJs?: boolean;
}

export function filterToolsByAllowed(
  tools: ToolDefinition[],
  allowedTools: string | undefined,
  options: FilterToolsOptions = {},
): ToolDefinition[] {
  const raw = allowedTools?.trim();
  if (!raw) {
    return tools;
  }

  const allowed = new Set(
    raw
      .split(/[,\s]+/)
      .map((name) => name.trim())
      .filter(Boolean),
  );

  if (options.includeRunJs) {
    allowed.add('run_js');
  }

  return tools.filter((tool) => allowed.has(tool.name));
}
