import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders nothing when bodyText is blank', () => {
    const { toJSON } = render(
      <CollapsibleSection title="Details" bodyText="   ">
        <Text>hidden body</Text>
      </CollapsibleSection>,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows collapsed header by default', () => {
    render(
      <CollapsibleSection title="Details" bodyText="hidden body">
        <Text>hidden body</Text>
      </CollapsibleSection>,
    );
    expect(screen.getByText(/Details/)).toBeTruthy();
    expect(screen.queryByText('hidden body')).toBeNull();
  });

  it('expands body on header press', () => {
    render(
      <CollapsibleSection title="Details" bodyText="visible body">
        <Text>visible body</Text>
      </CollapsibleSection>,
    );
    fireEvent.press(screen.getByText(/Details/));
    expect(screen.getByText('visible body')).toBeTruthy();
  });
});
