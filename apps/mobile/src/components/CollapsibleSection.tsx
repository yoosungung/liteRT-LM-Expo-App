import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** When set, renders nothing if blank after trim. */
  bodyText?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  bodyText,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (bodyText !== undefined && !bodyText.trim()) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded((value) => !value)} style={styles.header}>
        <Text style={styles.headerText}>
          {expanded ? '▼' : '▶'} {title}
        </Text>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

export const collapsibleStyles = StyleSheet.create({
  toggle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#52525b',
  },
});

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
    gap: 8,
  },
});
