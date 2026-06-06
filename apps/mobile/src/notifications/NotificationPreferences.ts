import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_NOTIFICATIONS = 'litertlm:notifications-enabled';

export class NotificationPreferences {
  async getEnabled(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(KEY_NOTIFICATIONS);
    if (raw === null) {
      return false;
    }
    return raw === 'true';
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_NOTIFICATIONS, enabled ? 'true' : 'false');
  }
}
