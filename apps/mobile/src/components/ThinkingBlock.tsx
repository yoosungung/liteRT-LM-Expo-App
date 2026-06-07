import { StyleSheet, Text } from 'react-native';

import { CollapsibleSection } from './CollapsibleSection';

interface ThinkingBlockProps {
  thinking: string;
  defaultExpanded?: boolean;
}

/** Phase 2.4 — collapsible thinking trace (Gemma 4 enable_thinking). */
export function ThinkingBlock({ thinking, defaultExpanded = false }: ThinkingBlockProps) {
  return (
    <CollapsibleSection title="Thinking" bodyText={thinking} defaultExpanded={defaultExpanded}>
      <Text style={styles.body}>{thinking}</Text>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 20,
  },
});
