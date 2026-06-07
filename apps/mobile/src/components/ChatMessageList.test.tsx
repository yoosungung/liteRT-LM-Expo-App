import { render, screen } from '@testing-library/react-native';

import { ChatMessageList } from './ChatMessageList';

describe('ChatMessageList', () => {
  it('renders user and assistant messages', () => {
    render(
      <ChatMessageList
        messages={[
          { id: '1', role: 'user', content: 'Hi', timestamp: 1 },
          { id: '2', role: 'assistant', content: 'Hello', timestamp: 2 },
        ]}
      />,
    );
    expect(screen.getByText('Hi')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders streaming assistant text with cursor', () => {
    render(
      <ChatMessageList
        messages={[]}
        streamingText="Typing"
      />,
    );
    expect(screen.getByText(/Typing/)).toBeTruthy();
  });

  it('renders thinking block for assistant messages with thinking', () => {
    render(
      <ChatMessageList
        messages={[
          {
            id: '2',
            role: 'assistant',
            content: 'Answer',
            thinking: 'internal reasoning',
            timestamp: 2,
          },
        ]}
      />,
    );
    expect(screen.getByText(/Thinking/)).toBeTruthy();
    expect(screen.getByText('Answer')).toBeTruthy();
  });

  it('renders collapsed tool call block for assistant messages', () => {
    render(
      <ChatMessageList
        messages={[
          {
            id: '2',
            role: 'assistant',
            content: 'It is noon.',
            toolCalls: [{ id: 't1', name: 'getCurrentTime', argumentsJson: '{}' }],
            timestamp: 2,
          },
        ]}
      />,
    );
    expect(screen.getByText(/Tool · getCurrentTime/)).toBeTruthy();
    expect(screen.queryByText('{}')).toBeNull();
  });

  it('collapses long assistant answers by default', () => {
    render(
      <ChatMessageList
        messages={[
          {
            id: '2',
            role: 'assistant',
            content: 'a'.repeat(500),
            timestamp: 2,
          },
        ]}
      />,
    );
    expect(screen.getByText(/Show full answer \(500 chars\)/)).toBeTruthy();
  });
});
