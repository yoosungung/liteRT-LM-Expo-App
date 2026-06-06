import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onStop,
  disabled,
  streaming,
  placeholder = 'Message…',
}: ChatInputProps) {
  const canSend = !disabled && !streaming && value.trim().length > 0;
  const canStop = streaming && !disabled && onStop;

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!disabled && !streaming}
        multiline
      />
      {canStop ? (
        <Pressable style={styles.stop} onPress={onStop}>
          <Text style={styles.stopLabel}>Stop</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.send, !canSend && styles.sendDisabled]}
          onPress={onSend}
          disabled={!canSend}
        >
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  send: {
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  stop: {
    backgroundColor: '#b91c1c',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stopLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
