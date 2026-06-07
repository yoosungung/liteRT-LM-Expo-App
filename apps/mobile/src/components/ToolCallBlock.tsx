import { StyleSheet, Text, View } from 'react-native';
import type { ToolCall } from 'litertlm-native';

import { CollapsibleSection } from './CollapsibleSection';

interface ToolCallBlockProps {
  toolCalls?: ToolCall[];
  defaultExpanded?: boolean;
}

export function formatToolCallTitle(toolCalls: ToolCall[]): string {
  if (toolCalls.length === 1) {
    return `Tool · ${toolCalls[0]!.name}`;
  }
  return `Tools · ${toolCalls.length} calls`;
}

export function ToolCallBlock({ toolCalls, defaultExpanded = false }: ToolCallBlockProps) {
  if (!toolCalls?.length) {
    return null;
  }

  return (
    <CollapsibleSection
      title={formatToolCallTitle(toolCalls)}
      defaultExpanded={defaultExpanded}
    >
      {toolCalls.map((toolCall) => (
        <View key={toolCall.id} style={styles.entry}>
          <Text style={styles.name}>{toolCall.name}</Text>
          <Text style={styles.args}>{toolCall.argumentsJson}</Text>
        </View>
      ))}
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  entry: {
    gap: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#27272a',
  },
  args: {
    fontSize: 12,
    color: '#52525b',
    fontFamily: 'Menlo',
    lineHeight: 18,
  },
});
