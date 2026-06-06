import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Backend } from 'litertlm-native';

import type { ModelId } from './manifest';

const STORAGE_KEY = '@litertlm/last-model';

export interface LastModelPreference {
  modelId: ModelId;
  backend?: Backend;
  updatedAt: number;
}

export class ModelPreferences {
  async getLastUsed(): Promise<LastModelPreference | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as LastModelPreference;
  }

  async getLastUsedModelId(): Promise<ModelId | null> {
    const pref = await this.getLastUsed();
    return pref?.modelId ?? null;
  }

  async setLastUsed(modelId: ModelId, backend?: Backend): Promise<void> {
    const pref: LastModelPreference = {
      modelId,
      backend,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  }
}
