import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAgentRuntime } from '../../src/context/AgentContext';
import type { InstalledSkill } from '../../src/skills/types';

function kindLabel(kind: InstalledSkill['kind']): string {
  switch (kind) {
    case 'javascript':
      return 'JS';
    case 'native':
      return 'Native';
    default:
      return 'Text';
  }
}

export default function SkillsScreen() {
  const runtime = useAgentRuntime();
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [importUrl, setImportUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => {
    await runtime.ensureSkillsLoaded();
    setSkills(runtime.listSkills());
    setLoading(false);
  }, [runtime]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const toggleSkill = async (name: string, enabled: boolean) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.frontmatter.name === name ? { ...skill, enabled } : skill,
      ),
    );
    await runtime.setSkillEnabled(name, enabled);
  };

  const removeSkill = (name: string) => {
    Alert.alert('Remove skill', `Remove "${name}" from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await runtime.removeSkill(name);
            await refresh();
          })();
        },
      },
    ]);
  };

  const importFromUrl = async () => {
    const trimmed = importUrl.trim();
    if (!trimmed) {
      return;
    }

    setImporting(true);
    try {
      const result = await runtime.importSkillFromUrl(trimmed);
      if ('error' in result) {
        Alert.alert('Import failed', result.error);
        return;
      }
      setImportUrl('');
      await refresh();
      Alert.alert('Skill imported', `${result.frontmatter.name} is ready to use.`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Import SKILL.md</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          Paste an HTTPS URL to a community SKILL.md (GitHub blob or raw). Skills follow the
          Agent Skills spec — only name and description appear in the system catalog until invoked.
        </Text>
        <TextInput
          style={styles.input}
          value={importUrl}
          onChangeText={setImportUrl}
          placeholder="https://raw.githubusercontent.com/.../SKILL.md"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!importing}
        />
        <Pressable
          style={[styles.primaryButton, importing && styles.buttonDisabled]}
          onPress={() => void importFromUrl()}
          disabled={importing || !importUrl.trim()}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Import skill</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Installed skills</Text>
      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : skills.length === 0 ? (
        <Text style={styles.empty}>No skills installed yet.</Text>
      ) : (
        skills.map((skill) => (
          <View key={skill.frontmatter.name} style={styles.row}>
            <View style={styles.rowText}>
              <View style={styles.titleRow}>
                <Text style={styles.label}>{skill.frontmatter.name}</Text>
                <View style={styles.kindBadge}>
                  <Text style={styles.kindBadgeText}>{kindLabel(skill.kind)}</Text>
                </View>
              </View>
              <Text style={styles.description}>{skill.frontmatter.description}</Text>
              <Text style={styles.hint}>
                Chat:{' '}
                <Text style={styles.mono}>/{skill.frontmatter.name} your request</Text>
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Switch
                value={skill.enabled}
                onValueChange={(value) => void toggleSkill(skill.frontmatter.name, value)}
              />
              <Pressable
                onPress={() => removeSkill(skill.frontmatter.name)}
                hitSlop={8}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Try it (mock)</Text>
      <Text style={styles.help}>
        Text skill:{'\n'}
        <Text style={styles.mono}>/fitness-coach give me a 15-minute workout</Text>
        {'\n\n'}
        JS skill (run_js sandbox):{'\n'}
        <Text style={styles.mono}>/hash-demo reverse text hello</Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  description: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  primaryButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#71717a',
    lineHeight: 18,
  },
  help: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 22,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
  },
  empty: {
    fontSize: 14,
    color: '#71717a',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
  },
  loader: {
    marginVertical: 12,
  },
  kindBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  kindBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
  },
  removeText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
  },
  mono: {
    fontFamily: 'Menlo',
    fontSize: 13,
    color: '#18181b',
  },
});
