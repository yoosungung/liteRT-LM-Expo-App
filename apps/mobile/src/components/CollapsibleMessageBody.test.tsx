import { fireEvent, render, screen } from '@testing-library/react-native';

import { CollapsibleMessageBody } from './CollapsibleMessageBody';

describe('CollapsibleMessageBody', () => {
  it('renders short content without toggle', () => {
    render(
      <CollapsibleMessageBody content="Short answer" textStyle={{ color: '#111' }} />,
    );
    expect(screen.getByText('Short answer')).toBeTruthy();
    expect(screen.queryByText(/Show full answer/)).toBeNull();
  });

  it('shows preview and expand toggle for long content', () => {
    const content = 'a'.repeat(500);
    render(<CollapsibleMessageBody content={content} textStyle={{ color: '#111' }} />);
    expect(screen.getByText(/Show full answer \(500 chars\)/)).toBeTruthy();
    expect(screen.queryByText(content)).toBeNull();
  });

  it('expands and collapses long content', () => {
    const content = 'a'.repeat(500);
    render(<CollapsibleMessageBody content={content} textStyle={{ color: '#111' }} />);
    fireEvent.press(screen.getByText(/Show full answer/));
    expect(screen.getByText(content)).toBeTruthy();
    fireEvent.press(screen.getByText('Show less'));
    expect(screen.getByText(/Show full answer/)).toBeTruthy();
  });

  it('does not truncate while streaming', () => {
    const content = 'a'.repeat(500);
    render(
      <CollapsibleMessageBody
        content={content}
        textStyle={{ color: '#111' }}
        isStreaming
      />,
    );
    expect(screen.getByText(`${content}▍`)).toBeTruthy();
  });
});
