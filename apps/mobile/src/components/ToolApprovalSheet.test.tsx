import { fireEvent, render, screen } from '@testing-library/react-native';

import { ToolApprovalSheet } from './ToolApprovalSheet';

const toolCall = {
  id: 'tool-1',
  name: 'openUrl',
  argumentsJson: '{"url":"https://example.com"}',
};

describe('ToolApprovalSheet', () => {
  it('renders null when toolCall is missing', () => {
    const { toJSON } = render(
      <ToolApprovalSheet
        visible
        toolCall={null}
        riskLevel="destructive"
        onApprove={() => {}}
        onDeny={() => {}}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('calls onApprove and onDeny', () => {
    const onApprove = jest.fn();
    const onDeny = jest.fn();

    render(
      <ToolApprovalSheet
        visible
        toolCall={toolCall}
        riskLevel="destructive"
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );

    expect(screen.getByText('Allow tool call?')).toBeTruthy();
    expect(screen.getByText(/openUrl/)).toBeTruthy();

    fireEvent.press(screen.getByText('Approve'));
    fireEvent.press(screen.getByText('Deny'));

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledTimes(1);
  });
});
