export interface ScheduledNotificationInput {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  triggerAtMs?: number;
}

export interface NotificationScheduler {
  schedule(input: ScheduledNotificationInput): Promise<string>;
  cancel(id: string): Promise<void>;
}

export class MemoryNotificationScheduler implements NotificationScheduler {
  readonly scheduled: ScheduledNotificationInput[] = [];

  async schedule(input: ScheduledNotificationInput): Promise<string> {
    this.scheduled.push(input);
    return input.id;
  }

  async cancel(id: string): Promise<void> {
    const index = this.scheduled.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      this.scheduled.splice(index, 1);
    }
  }
}

export class LocalNotificationService {
  constructor(private scheduler: NotificationScheduler) {}

  async scheduleChatReminder(input: {
    sessionId: string;
    title: string;
    body: string;
    skillName?: string;
  }): Promise<string> {
    return this.scheduler.schedule({
      id: `chat-${input.sessionId}`,
      title: input.title,
      body: input.body,
      data: {
        route: 'chat',
        sessionId: input.sessionId,
        ...(input.skillName ? { skillName: input.skillName } : {}),
      },
      triggerAtMs: Date.now() + 1_000,
    });
  }

  async cancelChatReminder(sessionId: string): Promise<void> {
    await this.scheduler.cancel(`chat-${sessionId}`);
  }
}
