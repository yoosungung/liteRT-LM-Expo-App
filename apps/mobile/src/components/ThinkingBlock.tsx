import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ThinkingBlockProps {
  thinking: string;
  defaultExpanded?: boolean;
}

/** Phase 2.4 — collapsible thinking trace (Gemma 4 enable_thinking). */
export function ThinkingBlock({ thinking, defaultExpanded = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!thinking.trim()) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header}>
        <Text style={styles.headerText}>{expanded ? '▼' : '▶'} Thinking</Text>
      </Pressable>
      {expanded ? <Text style={styles.body}>{thinking}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f4f4f5',
  },
  header: {
    marginBottom: 4,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525b',
  },
  body: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 20,
  },
});
