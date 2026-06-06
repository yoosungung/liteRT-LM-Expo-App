import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onPickImage?: () => void;
  onTakePhoto?: () => void;
  imageEnabled?: boolean;
  canSendWithMedia?: boolean;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onStop,
  onPickImage,
  onTakePhoto,
  imageEnabled = false,
  canSendWithMedia = false,
  disabled,
  streaming,
  placeholder = 'Message…',
}: ChatInputProps) {
  const canSend = !disabled && !streaming && (value.trim().length > 0 || canSendWithMedia);
  const canStop = streaming && !disabled && onStop;

  return (
    <View style={styles.row}>
      {imageEnabled ? (
        <View style={styles.mediaActions}>
          <Pressable
            style={[styles.mediaButton, (disabled || streaming) && styles.mediaButtonDisabled]}
            onPress={onPickImage}
            disabled={disabled || streaming}
          >
            <Text style={styles.mediaButtonLabel}>Photo</Text>
          </Pressable>
          <Pressable
            style={[styles.mediaButton, (disabled || streaming) && styles.mediaButtonDisabled]}
            onPress={onTakePhoto}
            disabled={disabled || streaming}
          >
            <Text style={styles.mediaButtonLabel}>Camera</Text>
          </Pressable>
        </View>
      ) : null}
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
  mediaActions: {
    gap: 6,
  },
  mediaButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  mediaButtonDisabled: {
    opacity: 0.45,
  },
  mediaButtonLabel: {
    color: '#111',
    fontSize: 12,
    fontWeight: '600',
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
