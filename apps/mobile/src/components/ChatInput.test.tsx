import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('disables send when input is empty', () => {
    const onSend = jest.fn();
    render(
      <ChatInput value="" onChangeText={() => {}} onSend={onSend} />,
    );
    fireEvent.press(screen.getByText('Send'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onSend when text is present', () => {
    const onSend = jest.fn();
    render(
      <ChatInput value="hello" onChangeText={() => {}} onSend={onSend} />,
    );
    fireEvent.press(screen.getByText('Send'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('shows Stop during streaming', () => {
    const onStop = jest.fn();
    render(
      <ChatInput
        value="hi"
        onChangeText={() => {}}
        onSend={() => {}}
        onStop={onStop}
        streaming
      />,
    );
    fireEvent.press(screen.getByText('Stop'));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Send')).toBeNull();
  });

  it('disables input while streaming', () => {
    render(
      <ChatInput
        value="hi"
        onChangeText={() => {}}
        onSend={() => {}}
        streaming
      />,
    );
    const input = screen.getByPlaceholderText('Message…');
    expect(input.props.editable).toBe(false);
  });
});
