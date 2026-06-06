import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SamplerConfig } from 'litertlm-native';

const KEY_SAMPLER = 'litertlm:sampler';
const KEY_THINKING = 'litertlm:thinking';
const KEY_AUTO_TOOLS = 'litertlm:automaticToolCalling';

export const DEFAULT_SAMPLER: Required<Pick<SamplerConfig, 'temperature' | 'topK'>> = {
  temperature: 0.8,
  topK: 40,
};

export class AgentPreferences {
  async getSampler(): Promise<SamplerConfig> {
    const raw = await AsyncStorage.getItem(KEY_SAMPLER);
    if (!raw) {
      return { ...DEFAULT_SAMPLER };
    }
    try {
      return { ...DEFAULT_SAMPLER, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SAMPLER };
    }
  }

  async setSampler(sampler: SamplerConfig): Promise<void> {
    await AsyncStorage.setItem(KEY_SAMPLER, JSON.stringify(sampler));
  }

  async getThinkingEnabled(): Promise<boolean> {
    return (await AsyncStorage.getItem(KEY_THINKING)) === '1';
  }

  async setThinkingEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_THINKING, enabled ? '1' : '0');
  }

  async getAutomaticToolCalling(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(KEY_AUTO_TOOLS);
    if (raw === '0') {
      return false;
    }
    return true;
  }

  async setAutomaticToolCalling(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_AUTO_TOOLS, enabled ? '1' : '0');
  }
}
