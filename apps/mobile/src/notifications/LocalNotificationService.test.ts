import { describe, expect, it } from 'vitest';

import { LocalNotificationService, MemoryNotificationScheduler } from './LocalNotificationService';
import { NotificationPreferences } from './NotificationPreferences';

describe('NotificationPreferences', () => {
  it('defaults notifications to disabled', async () => {
    const prefs = new NotificationPreferences();
    expect(await prefs.getEnabled()).toBe(false);
  });

  it('persists notification opt-in', async () => {
    const prefs = new NotificationPreferences();
    await prefs.setEnabled(true);
    expect(await prefs.getEnabled()).toBe(true);
  });
});

describe('LocalNotificationService', () => {
  it('schedules chat reminder with deep link payload', async () => {
    const scheduler = new MemoryNotificationScheduler();
    const service = new LocalNotificationService(scheduler);

    await service.scheduleChatReminder({
      sessionId: 'session-1',
      title: 'Continue chat',
      body: 'Your fitness coach skill is ready.',
      skillName: 'fitness-coach',
    });

    expect(scheduler.scheduled).toHaveLength(1);
    expect(scheduler.scheduled[0]?.data).toEqual({
      route: 'chat',
      sessionId: 'session-1',
      skillName: 'fitness-coach',
    });
  });
});
