import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ToolCall, ToolRiskLevel } from 'litertlm-native';

interface ToolApprovalSheetProps {
  visible: boolean;
  toolCall: ToolCall | null;
  riskLevel: ToolRiskLevel;
  onApprove: () => void;
  onDeny: () => void;
}

const RISK_LABEL: Record<ToolRiskLevel, string> = {
  read: 'Read-only',
  write: 'Write',
  destructive: 'Destructive',
};

/** Phase 2.3 — Human-in-the-loop tool approval (ARCHITECTURE §1.10). */
export function ToolApprovalSheet({
  visible,
  toolCall,
  riskLevel,
  onApprove,
  onDeny,
}: ToolApprovalSheetProps) {
  if (!toolCall) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Allow tool call?</Text>
          <Text style={styles.meta}>
            {toolCall.name} · {RISK_LABEL[riskLevel]}
          </Text>
          <Text style={styles.args} numberOfLines={6}>
            {toolCall.argumentsJson}
          </Text>
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.deny]} onPress={onDeny}>
              <Text style={styles.denyText}>Deny</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.approve]} onPress={onApprove}>
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: '#71717a',
    marginBottom: 12,
  },
  args: {
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: '#f4f4f5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deny: {
    backgroundColor: '#f4f4f5',
  },
  approve: {
    backgroundColor: '#18181b',
  },
  denyText: {
    color: '#18181b',
    fontWeight: '600',
  },
  approveText: {
    color: '#fff',
    fontWeight: '600',
  },
});
