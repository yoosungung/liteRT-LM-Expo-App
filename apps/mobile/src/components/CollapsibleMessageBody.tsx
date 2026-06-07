import { useState } from 'react';
import { Pressable, Text, type TextStyle } from 'react-native';

import { collapsibleStyles } from './CollapsibleSection';
import {
  shouldTruncateContent,
  truncateContentPreview,
} from './messageContentPreview';

interface CollapsibleMessageBodyProps {
  content: string;
  textStyle: TextStyle;
  isStreaming?: boolean;
}

export function CollapsibleMessageBody({
  content,
  textStyle,
  isStreaming = false,
}: CollapsibleMessageBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncate = !isStreaming && shouldTruncateContent(content);

  if (!needsTruncate) {
    return (
      <Text style={textStyle}>
        {content}
        {isStreaming && content ? '▍' : ''}
      </Text>
    );
  }

  if (expanded) {
    return (
      <>
        <Text style={textStyle}>{content}</Text>
        <Pressable onPress={() => setExpanded(false)} accessibilityRole="button">
          <Text style={collapsibleStyles.toggle}>Show less</Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      <Text style={textStyle}>{truncateContentPreview(content)}…</Text>
      <Pressable onPress={() => setExpanded(true)} accessibilityRole="button">
        <Text style={collapsibleStyles.toggle}>Show full answer ({content.length} chars)</Text>
      </Pressable>
    </>
  );
}
