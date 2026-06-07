import { fireEvent, render, screen } from '@testing-library/react-native';

import { formatToolCallTitle, ToolCallBlock } from './ToolCallBlock';

describe('ToolCallBlock', () => {
  it('formats single and multiple tool titles', () => {
    expect(formatToolCallTitle([{ id: '1', name: 'getCurrentTime', argumentsJson: '{}' }])).toBe(
      'Tool · getCurrentTime',
    );
    expect(
      formatToolCallTitle([
        { id: '1', name: 'a', argumentsJson: '{}' },
        { id: '2', name: 'b', argumentsJson: '{}' },
      ]),
    ).toBe('Tools · 2 calls');
  });

  it('renders collapsed tool details by default', () => {
    render(
      <ToolCallBlock
        toolCalls={[{ id: '1', name: 'getCurrentTime', argumentsJson: '{"tz":"UTC"}' }]}
      />,
    );
    expect(screen.getByText(/getCurrentTime/)).toBeTruthy();
    expect(screen.queryByText('{"tz":"UTC"}')).toBeNull();
  });

  it('expands tool arguments on press', () => {
    render(
      <ToolCallBlock
        toolCalls={[{ id: '1', name: 'getCurrentTime', argumentsJson: '{"tz":"UTC"}' }]}
      />,
    );
    fireEvent.press(screen.getByText(/Tool · getCurrentTime/));
    expect(screen.getByText('{"tz":"UTC"}')).toBeTruthy();
  });
});
