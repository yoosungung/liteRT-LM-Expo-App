import type { Message, LitertLmEngine } from 'litertlm-native';

/**
 * Rebuilds conversation KV context from SessionStore messages when native KV serialize is unavailable.
 * Consumes model output silently; UI continues to show stored messages.
 */
export async function replaySessionMessages(
  engine: LitertLmEngine,
  conversationId: string,
  messages: Message[],
): Promise<number> {
  const userTurns = messages.filter((message) => message.role === 'user');
  if (userTurns.length === 0) {
    return 0;
  }

  let replayed = 0;
  for (const message of userTurns) {
    const text = message.content.trim();
    if (!text) {
      continue;
    }
    await engine.sendMessageSync(conversationId, text);
    replayed += 1;
  }
  return replayed;
}

export function countReplayableUserTurns(messages: Message[]): number {
  return messages.filter((message) => message.role === 'user' && message.content.trim()).length;
}
