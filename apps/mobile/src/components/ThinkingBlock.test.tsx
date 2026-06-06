import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThinkingBlock } from './ThinkingBlock';

describe('ThinkingBlock', () => {
  it('renders nothing when thinking is empty', () => {
    const { toJSON } = render(<ThinkingBlock thinking="   " />);
    expect(toJSON()).toBeNull();
  });

  it('shows collapsed header by default', () => {
    render(<ThinkingBlock thinking="reasoning trace" />);
    expect(screen.getByText(/Thinking/)).toBeTruthy();
    expect(screen.queryByText('reasoning trace')).toBeNull();
  });

  it('expands to show thinking body on press', () => {
    render(<ThinkingBlock thinking="reasoning trace" defaultExpanded={false} />);
    fireEvent.press(screen.getByText(/Thinking/));
    expect(screen.getByText('reasoning trace')).toBeTruthy();
  });

  it('shows body when defaultExpanded is true', () => {
    render(<ThinkingBlock thinking="visible trace" defaultExpanded />);
    expect(screen.getByText('visible trace')).toBeTruthy();
  });
});
