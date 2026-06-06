import * as SecureStore from 'expo-secure-store';

export interface HfTokenProvider {
  getToken(): Promise<string | null>;
  setToken(token: string | null): Promise<void>;
}

const SECURE_KEY = 'litertlm:hf-token';
export const HF_TOKEN_STORAGE_KEY = SECURE_KEY;

export class MemoryHfTokenProvider implements HfTokenProvider {
  private token: string | null = null;

  async getToken(): Promise<string | null> {
    return this.token;
  }

  async setToken(token: string | null): Promise<void> {
    this.token = token;
  }
}

export function readEnvHfToken(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.EXPO_PUBLIC_HF_TOKEN ?? env?.HF_TOKEN;
}

export async function resolveHfDownloadToken(
  provider: HfTokenProvider,
  envReader: () => string | undefined = readEnvHfToken,
): Promise<string | undefined> {
  const envToken = envReader()?.trim();
  if (envToken) {
    return envToken;
  }
  const stored = (await provider.getToken())?.trim();
  return stored || undefined;
}

export class SecureHfTokenStore implements HfTokenProvider {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(HF_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  async setToken(token: string | null): Promise<void> {
    if (!token) {
      await SecureStore.deleteItemAsync(HF_TOKEN_STORAGE_KEY);
      return;
    }
    await SecureStore.setItemAsync(HF_TOKEN_STORAGE_KEY, token);
  }
}

let defaultHfTokenProvider: HfTokenProvider = new MemoryHfTokenProvider();

export function getDefaultHfTokenProvider(): HfTokenProvider {
  return defaultHfTokenProvider;
}

export function setDefaultHfTokenProvider(provider: HfTokenProvider): void {
  defaultHfTokenProvider = provider;
}
